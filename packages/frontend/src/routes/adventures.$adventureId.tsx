import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { useBroadcastSender } from '../hooks/useBroadcast';
import { useCurrentAdventure } from '../context/AdventureContext';
import type { SceneFit } from '@gmassisstant/types';
import { Open5eSearch } from '../components/Open5eSearch';
import { MonsterLibrary } from '../components/MonsterLibrary';
import { GmHeader, dropdownItem, dropdownItemActive } from '../components/GmHeader';
import { StatBlockEditor } from '../components/StatBlockEditor';
import { ImportModal } from '../components/ImportModal';
import { useAudio, type Playlist, type PlaylistTrack } from '../hooks/useAudio';
import { usePlayerScreen } from '../hooks/usePlayerScreen';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { preloadAssets } from '../lib/preloadAssets';
import { downloadGmaExport } from '../lib/exportGma';
import { isElectron } from '../lib/platform';

// ── Types ────────────────────────────────────────────────────────────────────

interface Combatant {
  id: number;
  name: string;
  maxHp: number;
  initiativeModifier: number;
  type: 'pc' | 'npc' | 'enemy' | 'group' | 'event' | 'lair';
  color: string | null;
  description: string | null;
  visibleToPlayers: boolean;
  statBlock?: string | null;
  inLair?: boolean;
  members?: { id: number; label: string; maxHp: number }[];
}

interface Encounter {
  id: number;
  name: string;
  description: string | null;
  playlistId: number | null;
  stopPlaylist: boolean;
  ambientPlaylistId: number | null;
  stopAmbient: boolean;
  sortOrder: number;
  combatants: Combatant[];
}

interface SceneImage {
  id: number;
  sceneId: number;
  filePath: string;
  sortOrder: number;
  fit: SceneFit;
  playlistId: number | null;
  stopPlaylist: boolean;
  ambientPlaylistId: number | null;
  stopAmbient: boolean;
}

interface ImageScene {
  id: number;
  name: string;
  sortOrder: number;
  images: SceneImage[];
}

interface Player {
  id: number;
  adventureId: number;
  name: string;
  maxHp: number;
  initiativeModifier: number;
  color: string | null;
  armorClass: number | null;
  spellDc: number | null;
  passivePerception: number | null;
}

interface AdventureDetail {
  id: number;
  name: string;
  description: string | null;
  showHp: boolean;
  showInitiative: boolean;
  players: Player[];
  imageScenes: ImageScene[];
  encounters: Encounter[];
  playlists: Playlist[];
}

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/adventures/$adventureId')({
  component: AdventureDetailPage,
});

const HOVER_STYLE = `
  .image-tile:hover .tile-overlay { opacity: 1 !important; }
  .tile-icon-btn:disabled { opacity: 0.3; cursor: default; }
`;

function HoverStyles() {
  return <style>{HOVER_STYLE}</style>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

function AdventureDetailPage() {
  const { adventureId } = Route.useParams();
  const qc = useQueryClient();
  const qKey = ['adventure', adventureId];
  const send = useBroadcastSender();
  const { setAdventureId } = useCurrentAdventure();
  const { playerImage, showImage, clearImage } = usePlayerScreen();
  const { playPlaylist, playAmbientPlaylist, stop, stopAmbient } = useAudio();

  useEffect(() => {
    setAdventureId(Number(adventureId));
    return () => setAdventureId(null);
  }, [adventureId]);

  // Restore player image on mount. Only resume its playlist when returning from a
  // completed encounter (no run key in localStorage) — clicking Back leaves the
  // encounter active, so we leave audio alone in that case.
  useEffect(() => {
    if (!playerImage) return;
    send({ type: 'SHOW_IMAGE', payload: { filePath: playerImage.filePath, fit: playerImage.fit } });
    if (data) {
      const hasActiveEncounter = data.encounters.some((e) => !!localStorage.getItem(`gma:run:${e.id}`));
      if (!hasActiveEncounter) {
        const img = data.imageScenes.flatMap((s) => s.images).find((i) => i.filePath === playerImage.filePath);
        const pl = img?.playlistId ? data.playlists.find((p) => p.id === img.playlistId) : null;
        if (pl && pl.tracks.length > 0) playPlaylist(pl);
        else if (img?.stopPlaylist) stop();
        const ambient = img?.ambientPlaylistId ? data.playlists.find((p) => p.id === img.ambientPlaylistId) : null;
        if (ambient && ambient.tracks.length > 0) playAmbientPlaylist(ambient);
        else if (img?.stopAmbient) stopAmbient();
      }
    }
  }, []);

  const { data, isLoading } = useQuery<AdventureDetail>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch(`/api/adventures/${adventureId}`);
      if (!res.ok) throw new Error('Failed to load adventure');
      return res.json();
    },
  });

  // Warm the asset cache as soon as the GM opens the adventure, so scene/track
  // switches during a live session never wait on the network. YouTube tracks
  // are streamed and excluded on purpose.
  useEffect(() => {
    if (!data) return;
    const imageUrls = data.imageScenes.flatMap((s) => s.images.map((i) => i.filePath));
    const trackUrls = data.playlists.flatMap((p) => p.tracks.filter((t) => t.type === 'file').map((t) => t.url));
    preloadAssets([...imageUrls, ...trackUrls]);
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qKey });

  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  async function handleExportAdventure() {
    setExportProgress({ done: 0, total: 0 });
    try {
      await downloadGmaExport('adventure', Number(adventureId), `adventure-${adventureId}.gma.zip`, (done, total) => setExportProgress({ done, total }));
    } finally {
      setExportProgress(null);
    }
  }

  const toggleShowHp = useMutation({
    mutationFn: async (showHp: boolean) => {
      const res = await fetch(`/api/adventures/${adventureId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data!.name, description: data!.description, showHp }),
      });
      if (!res.ok) throw new Error('Failed to update adventure');
      return showHp;
    },
    onSuccess: (showHp) => {
      invalidate();
      send({ type: 'SET_SHOW_HP', payload: { showHp } });
      try {
        const raw = localStorage.getItem('gma:initiative');
        if (raw) localStorage.setItem('gma:initiative', JSON.stringify({ ...JSON.parse(raw), showHp }));
      } catch {}
    },
  });

  const toggleShowInitiative = useMutation({
    mutationFn: async (showInitiative: boolean) => {
      const res = await fetch(`/api/adventures/${adventureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showInitiative }),
      });
      if (!res.ok) throw new Error('Failed to update adventure');
      return showInitiative;
    },
    onSuccess: (showInitiative) => {
      invalidate();
      send({ type: 'SET_SHOW_INITIATIVE', payload: { showInitiative } });
      try {
        const raw = localStorage.getItem('gma:initiative');
        if (raw) localStorage.setItem('gma:initiative', JSON.stringify({ ...JSON.parse(raw), showInitiative }));
      } catch {}
    },
  });

  const addEncounter = useMutation({
    mutationFn: async (body: { name: string; description: string }) => {
      const res = await fetch('/api/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId: Number(adventureId), ...body }),
      });
      if (!res.ok) throw new Error('Failed to create encounter');
    },
    onSuccess: invalidate,
  });

  const deleteEncounter = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/encounters/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      localStorage.removeItem(`gma:run:${id}`);
      invalidate();
    },
  });

  const addScene = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/adventures/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adventureId: Number(adventureId),
          name,
          sortOrder: data?.imageScenes.length ?? 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to create scene');
    },
    onSuccess: invalidate,
  });

  const deleteScene = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/adventures/scenes/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidate,
  });

  const renameScene = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await fetch(`/api/adventures/scenes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: invalidate,
  });

  const addPlayer = useMutation({
    mutationFn: async (body: { name: string; maxHp: number; initiativeModifier: number; color: string; armorClass: number | null; spellDc: number | null; passivePerception: number | null }) => {
      const res = await fetch('/api/adventures/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId: Number(adventureId), ...body }),
      });
      if (!res.ok) throw new Error('Failed to add player');
    },
    onSuccess: invalidate,
  });

  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editingAdventure, setEditingAdventure] = useState(false);
  const [showImportEncounter, setShowImportEncounter] = useState(false);
  const [adventureNameDraft, setAdventureNameDraft] = useState('');
  const [adventureDescDraft, setAdventureDescDraft] = useState('');
  const [deleteSceneTarget, setDeleteSceneTarget] = useState<ImageScene | null>(null);
  const [deleteEncounterTarget, setDeleteEncounterTarget] = useState<Encounter | null>(null);

  const [localEncounters, setLocalEncounters] = useState<Encounter[]>([]);
  const [draggingEncounterId, setDraggingEncounterId] = useState<number | null>(null);
  const encounterDragDroppedRef = useRef(false);
  const encounterLastOverRef = useRef<number | null>(null);

  useEffect(() => {
    if (draggingEncounterId === null && data)
      setLocalEncounters([...data.encounters].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
  }, [data?.encounters]);

  const reorderEncounters = useMutation({
    mutationFn: async (ordered: Encounter[]) => {
      await Promise.all(
        ordered.map((enc, i) =>
          fetch(`/api/encounters/${enc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: i }),
          })
        )
      );
    },
    onSuccess: invalidate,
  });

  function handleEncounterDragStart(id: number) {
    encounterDragDroppedRef.current = false;
    encounterLastOverRef.current = null;
    setDraggingEncounterId(id);
  }

  function handleEncounterDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    if (draggingEncounterId === null || draggingEncounterId === id || encounterLastOverRef.current === id) return;
    encounterLastOverRef.current = id;
    setLocalEncounters(prev => {
      const from = prev.findIndex(t => t.id === draggingEncounterId);
      const to = prev.findIndex(t => t.id === id);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function handleEncounterDrop() {
    encounterDragDroppedRef.current = true;
    setDraggingEncounterId(null);
    reorderEncounters.mutate(localEncounters);
  }

  function handleEncounterDragEnd() {
    if (!encounterDragDroppedRef.current && data)
      setLocalEncounters([...data.encounters].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    encounterDragDroppedRef.current = false;
    setDraggingEncounterId(null);
  }

  const updateAdventure = useMutation({
    mutationFn: async (body: { name: string; description: string }) => {
      const res = await fetch(`/api/adventures/${adventureId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, showHp: data!.showHp }),
      });
      if (!res.ok) throw new Error('Failed to update adventure');
    },
    onSuccess: () => { invalidate(); setEditingAdventure(false); },
  });

  function startEditingAdventure() {
    setAdventureNameDraft(data!.name);
    setAdventureDescDraft(data!.description ?? '');
    setEditingAdventure(true);
  }

  const updatePlayer = useMutation({
    mutationFn: async (body: { id: number; name: string; maxHp: number; initiativeModifier: number; color: string; armorClass: number | null; spellDc: number | null; passivePerception: number | null }) => {
      const res = await fetch(`/api/adventures/players/${body.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: body.name, maxHp: body.maxHp, initiativeModifier: body.initiativeModifier, color: body.color, armorClass: body.armorClass, spellDc: body.spellDc, passivePerception: body.passivePerception }),
      });
      if (!res.ok) throw new Error('Failed to update player');
    },
    onSuccess: () => { invalidate(); setEditingPlayerId(null); },
  });

  const deletePlayer = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/adventures/players/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidate,
  });

  if (isLoading) return <div style={s.page}><p style={s.muted}>Loading...</p></div>;
  if (!data) return <div style={s.page}><p style={s.muted}>Adventure not found.</p></div>;

  return (
    <div style={s.page}>
      <HoverStyles />
      <GmHeader
        onPlaylistChange={invalidate}
        rightSlot={
          isElectron() ? (
            <a
              href={`/api/export/adventure/${adventureId}`}
              download
              style={s.btnSecondary as React.CSSProperties}
              title="Export adventure as .gma.zip"
            >↓ Export Adventure</a>
          ) : (
            <button
              type="button"
              onClick={handleExportAdventure}
              disabled={exportProgress != null}
              style={s.btnSecondary as React.CSSProperties}
              title="Export adventure as .gma.zip"
            >
              {exportProgress
                ? exportProgress.total > 0
                  ? `Exporting… ${exportProgress.done}/${exportProgress.total}`
                  : 'Exporting…'
                : '↓ Export Adventure'}
            </button>
          )
        }
        playerMenuItems={
          <>
            <button
              style={data.showInitiative ? dropdownItemActive : dropdownItem}
              onClick={() => toggleShowInitiative.mutate(!data.showInitiative)}
              disabled={toggleShowInitiative.isPending}
            >
              {data.showInitiative ? '✔ Initiative visible' : '✗ Initiative hidden'}
            </button>
            <button
              style={data.showHp ? dropdownItemActive : dropdownItem}
              onClick={() => toggleShowHp.mutate(!data.showHp)}
              disabled={toggleShowHp.isPending}
            >
              {data.showHp ? '✔ HP visible' : '✗ HP hidden'}
            </button>
          </>
        }
      >
        <Link to="/" style={s.back}>← Adventures</Link>
        {editingAdventure ? (
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}
            onSubmit={(e) => { e.preventDefault(); if (adventureNameDraft.trim()) updateAdventure.mutate({ name: adventureNameDraft.trim(), description: adventureDescDraft.trim() }); }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...s.editInput, fontSize: '1.2rem', fontWeight: 700, flex: 1 }}
                value={adventureNameDraft}
                onChange={(e) => setAdventureNameDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingAdventure(false); }}
              />
              <button style={s.btnPrimary} type="submit" disabled={!adventureNameDraft.trim() || updateAdventure.isPending}>Save</button>
              <button style={s.btnGhost} type="button" onClick={() => setEditingAdventure(false)}>Cancel</button>
            </div>
            <input
              style={{ ...s.editInput, fontSize: '0.875rem' }}
              placeholder="Description (optional)"
              value={adventureDescDraft}
              onChange={(e) => setAdventureDescDraft(e.target.value)}
            />
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <h1 style={{ ...s.title, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{data.name}</h1>
            <button style={{ ...s.btnGhost, flexShrink: 0 }} onClick={startEditingAdventure} title="Edit adventure name">✎</button>
          </div>
        )}
      </GmHeader>

      <main style={s.main}>
        {data.description && <p style={s.desc}>{data.description}</p>}

        {/* Players */}
        <Section
          title="Players"
          count={data.players.length}
          addLabel="+ Add Player"
          addForm={(close) => (
            <PlayerForm
              onSubmit={(v) => addPlayer.mutate(v, { onSuccess: close })}
              pending={addPlayer.isPending}
              onCancel={close}
            />
          )}
        >
          {data.players.map((p) => (
            editingPlayerId === p.id ? (
              <PlayerForm
                key={p.id}
                initialValues={p}
                onSubmit={(v) => updatePlayer.mutate({ id: p.id, ...v })}
                pending={updatePlayer.isPending}
                onCancel={() => setEditingPlayerId(null)}
              />

            ) : (
              <div key={p.id} style={s.combatantRow}>
                {p.color && <span style={{ ...s.colorDot, background: p.color }} />}
                <span style={s.combatantName}>{p.name}</span>
                {p.armorClass != null && <span style={s.playerStat}>AC {p.armorClass}</span>}
                {p.spellDc != null && <span style={s.playerStat}>DC {p.spellDc}</span>}
                {p.passivePerception != null && <span style={s.playerStat}>PP {p.passivePerception}</span>}
                <button style={s.btnIcon} onClick={() => setEditingPlayerId(p.id)} title="Edit">✎</button>
                <button style={{ ...s.btnIcon, color: '#ef5350' }} onClick={() => deletePlayer.mutate(p.id)} title="Delete">🗑</button>
              </div>
            )
          ))}
        </Section>

        {showImportEncounter && (
          <ImportModal
            defaultTargetAdventureId={Number(adventureId)}
            onClose={() => setShowImportEncounter(false)}
            onSuccess={() => { setShowImportEncounter(false); invalidate(); }}
          />
        )}

        {/* Image Scenes */}
        <Section
          title="Image Scenes"
          count={data.imageScenes.length}
          addLabel="+ Add Scene"
          addForm={(close) => (
            <SimpleNameForm
              placeholder="Scene name"
              submitLabel="Add Scene"
              onSubmit={(name) => addScene.mutate(name, { onSuccess: close })}
              pending={addScene.isPending}
              onCancel={close}
            />
          )}
        >
          {data.imageScenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              playlists={data.playlists}
              onRename={(name) => renameScene.mutate({ id: scene.id, name })}
              onDelete={() => setDeleteSceneTarget(scene)}
              onInvalidate={invalidate}
              onSend={(filePath, fit, transition) => showImage(filePath, fit, transition)}
              onClearPlayer={(transition) => clearImage(transition)}
              playerImage={playerImage}
            />
          ))}
        </Section>

        {/* Encounters */}
        <Section
          title="Encounters"
          count={data.encounters.length}
          addLabel="+ Add Encounter"
          headerActions={
            <button style={s.btnSecondary} onClick={() => setShowImportEncounter(true)}>↑ Import Encounter</button>
          }
          addForm={(close) => (
            <EncounterForm
              onSubmit={(v) => addEncounter.mutate(v, { onSuccess: close })}
              pending={addEncounter.isPending}
              onCancel={close}
            />
          )}
        >
          {localEncounters.map((e) => (
            <div
              key={e.id}
              style={{ opacity: e.id === draggingEncounterId ? 0.35 : 1, transition: 'opacity 0.1s' }}
              draggable
              onDragStart={() => handleEncounterDragStart(e.id)}
              onDragOver={(ev) => handleEncounterDragOver(ev, e.id)}
              onDrop={handleEncounterDrop}
              onDragEnd={handleEncounterDragEnd}
            >
              <EncounterCard
                encounter={e}
                allEncounters={data.encounters}
                playlists={data.playlists}
                scenes={data.imageScenes}
                onDelete={() => setDeleteEncounterTarget(e)}
                onInvalidate={invalidate}
              />
            </div>
          ))}
        </Section>
      </main>

      {deleteSceneTarget && (
        <DeleteConfirmModal
          title="Delete Scene"
          name={deleteSceneTarget.name}
          description="All images in this scene will also be deleted. This cannot be undone."
          isPending={deleteScene.isPending}
          onConfirm={() => deleteScene.mutate(deleteSceneTarget.id, { onSuccess: () => setDeleteSceneTarget(null) })}
          onCancel={() => setDeleteSceneTarget(null)}
        />
      )}

      {deleteEncounterTarget && (
        <DeleteConfirmModal
          title="Delete Encounter"
          name={deleteEncounterTarget.name}
          description="All combatants and encounter history will be deleted. This cannot be undone."
          isPending={deleteEncounter.isPending}
          onConfirm={() => deleteEncounter.mutate(deleteEncounterTarget.id, { onSuccess: () => setDeleteEncounterTarget(null) })}
          onCancel={() => setDeleteEncounterTarget(null)}
        />
      )}
    </div>
  );
}

// ── SceneCard ─────────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  playlists,
  onRename,
  onDelete,
  onInvalidate,
  onSend,
  onClearPlayer,
  playerImage,
}: {
  scene: ImageScene;
  playlists: Playlist[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onInvalidate: () => void;
  onSend: (filePath: string, fit: SceneFit, transition: 'fade' | 'cut') => void;
  onClearPlayer: (transition: 'fade' | 'cut') => void;
  playerImage: { filePath: string; fit: SceneFit } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playPlaylist, playAmbientPlaylist, stop, stopAmbient } = useAudio();

  const setImagePlaylist = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: string }) => {
      const body = value === 'stop'
        ? { playlistId: null, stopPlaylist: true }
        : { playlistId: value ? Number(value) : null, stopPlaylist: false };
      await fetch(`/api/adventures/scenes/images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: onInvalidate,
  });

  const setImageAmbientPlaylist = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: string }) => {
      const body = value === 'stop'
        ? { ambientPlaylistId: null, stopAmbient: true }
        : { ambientPlaylistId: value ? Number(value) : null, stopAmbient: false };
      await fetch(`/api/adventures/scenes/images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: onInvalidate,
  });

  const updateImageFit = useMutation({
    mutationFn: async ({ id, fit, filePath }: { id: number; fit: SceneFit; filePath: string }) => {
      await fetch(`/api/adventures/scenes/images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fit }),
      });
      return { fit, filePath };
    },
    onSuccess: ({ fit, filePath }) => {
      onInvalidate();
      if (playerImage?.filePath === filePath) {
        onSend(filePath, fit, 'cut');
      }
    },
  });

  const addImage = useMutation({
    mutationFn: async ({ url, sortOrder }: { url: string; sortOrder: number }) => {
      const res = await fetch('/api/adventures/scenes/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId: scene.id, filePath: url, sortOrder }),
      });
      if (!res.ok) throw new Error('Failed to add image');
    },
    onSuccess: onInvalidate,
  });

  const removeImage = useMutation({
    mutationFn: async (imageId: number) => {
      await fetch(`/api/adventures/scenes/images/${imageId}`, { method: 'DELETE' });
    },
    onSuccess: onInvalidate,
  });

  const reorderImages = useMutation({
    mutationFn: async (ordered: SceneImage[]) => {
      await Promise.all(
        ordered.map((img, i) =>
          fetch(`/api/adventures/scenes/images/${img.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: i }),
          })
        )
      );
    },
    onSuccess: onInvalidate,
  });

  const [localImages, setLocalImages] = useState<SceneImage[]>(() =>
    [...scene.images].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const lastOverIdRef = useRef<number | null>(null);
  const droppedRef = useRef(false);

  useEffect(() => {
    if (draggingId === null)
      setLocalImages([...scene.images].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [scene.images]);

  function handleImgDragStart(id: number) {
    droppedRef.current = false;
    lastOverIdRef.current = null;
    setDraggingId(id);
  }

  function handleImgDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    if (draggingId === null || draggingId === id || lastOverIdRef.current === id) return;
    lastOverIdRef.current = id;
    setLocalImages(prev => {
      const from = prev.findIndex(t => t.id === draggingId);
      const to = prev.findIndex(t => t.id === id);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function handleImgDrop() {
    droppedRef.current = true;
    setDraggingId(null);
    reorderImages.mutate(localImages);
  }

  function handleImgDragEnd() {
    if (!droppedRef.current)
      setLocalImages([...scene.images].sort((a, b) => a.sortOrder - b.sortOrder));
    droppedRef.current = false;
    setDraggingId(null);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const baseOrder = scene.images.length;
    try {
      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append('file', files[i]);
        const res = await fetch('/api/uploads', { method: 'POST', body: form });
        if (!res.ok) continue;
        const { url } = await res.json() as { url: string };
        await addImage.mutateAsync({ url, sortOrder: baseOrder + i });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div style={s.sceneWrapper}>
      <div style={s.card}>
        <div style={s.cardBody}>
          {editingName ? (
            <form
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              onSubmit={(e) => { e.preventDefault(); const n = nameDraft.trim(); if (n) onRename(n); setEditingName(false); }}
            >
              <input
                style={{ ...s.editInput, fontSize: '0.875rem', flex: 1 }}
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingName(false); }}
              />
              <button style={s.btnSecondarySmall} type="submit" disabled={!nameDraft.trim()}>Save</button>
              <button style={s.btnGhost} type="button" onClick={() => setEditingName(false)}>✕</button>
            </form>
          ) : (
            <strong style={s.cardTitle}>{scene.name}</strong>
          )}
        </div>
        <div style={s.cardRight}>
          <span style={s.badge}>{scene.images.length} images</span>
          <button style={s.btnSecondarySmall} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Close' : 'Manage'}
          </button>
          <button style={s.btnIcon} onClick={() => { setNameDraft(scene.name); setEditingName(true); }} title="Rename scene">✎</button>
          <button style={{ ...s.btnIcon, color: '#ef5350' }} onClick={onDelete} title="Delete scene">🗑</button>
        </div>
      </div>

      {expanded && (
        <div style={s.sceneDetail}>
          <div style={s.sceneToolbar}>
            <button
              style={s.btnPrimary}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : '+ Add Images'}
            </button>
            <button style={s.btnSecondarySmall} onClick={() => onClearPlayer('cut')}>
              Clear Player Screen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {localImages.length === 0 && (
            <p style={s.muted}>No images yet. Add some to get started.</p>
          )}

          <div style={s.imageGrid}>
            {localImages.map((img) => (
              <div
                key={img.id}
                style={{ ...s.imageTileWrapper, opacity: img.id === draggingId ? 0.35 : 1, transition: 'opacity 0.1s' }}
                draggable
                onDragStart={() => handleImgDragStart(img.id)}
                onDragOver={(e) => handleImgDragOver(e, img.id)}
                onDrop={handleImgDrop}
                onDragEnd={handleImgDragEnd}
              >
                <div style={s.imageTile} className="image-tile">
                  <img src={img.filePath} alt="" draggable={false} style={s.thumbnail} />
                  <span style={s.dragHandle} title="Drag to reorder">⠿</span>
                  <div style={s.tileOverlay} className="tile-overlay">
                    <button
                      style={{ ...s.tileBtn, ...(playerImage?.filePath === img.filePath ? { background: '#c9a84c', color: '#1a1a2e' } : {}) }}
                      title={playerImage?.filePath === img.filePath ? 'Hide (shift+click to fade)' : 'Show (shift+click to fade)'}
                      onClick={(e) => {
                        const transition = e.shiftKey ? 'fade' : 'cut';
                        if (playerImage?.filePath === img.filePath) {
                          onClearPlayer(transition);
                        } else {
                          onSend(img.filePath, img.fit, transition);
                          const imgPlaylist = playlists.find((p) => p.id === img.playlistId) ?? null;
                          if (imgPlaylist && imgPlaylist.tracks.length > 0) playPlaylist(imgPlaylist);
                          else if (img.stopPlaylist) stop();
                          const imgAmbient = playlists.find((p) => p.id === img.ambientPlaylistId) ?? null;
                          if (imgAmbient && imgAmbient.tracks.length > 0) playAmbientPlaylist(imgAmbient);
                          else if (img.stopAmbient) stopAmbient();
                        }
                      }}
                    >
                      {playerImage?.filePath === img.filePath ? '■ Hide' : '▶ Show'}
                    </button>
                    <div style={s.tileActions}>
                      <button
                        style={{ ...s.tileIconBtn, color: '#e05c5c' }}
                        onClick={() => removeImage.mutate(img.id)}
                        title="Remove"
                      >🗑</button>
                    </div>
                  </div>
                </div>
                <div style={s.fitToggle}>
                  {(['cover', 'fit', 'center'] as SceneFit[]).map((f) => (
                    <button
                      key={f}
                      style={img.fit === f ? s.fitBtnActive : s.fitBtn}
                      onClick={() => updateImageFit.mutate({ id: img.id, fit: f, filePath: img.filePath })}
                      title={f === 'cover' ? 'Fill screen (crop)' : f === 'fit' ? 'Fit to screen (letterbox)' : 'Natural size (centered)'}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: '#666' }}>🎵</span>
                  <select
                    style={{ ...s.input, fontSize: '0.7rem', padding: '2px 4px', color: '#888', flex: 1 }}
                    value={img.stopPlaylist ? 'stop' : (img.playlistId ? String(img.playlistId) : '')}
                    onChange={(e) => setImagePlaylist.mutate({ id: img.id, value: e.target.value })}
                  >
                    <option value="">— No change</option>
                    <option value="stop">🔇 Stop</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {img.playlistId && (() => { const pl = playlists.find((p) => p.id === img.playlistId); return pl && pl.tracks.length > 0 ? <button style={{ ...s.btnIcon, color: '#c9a84c' }} title="Play now" onClick={() => playPlaylist(pl)}>▶</button> : null; })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: '0.7rem', color: '#666' }}>🌿</span>
                  <select
                    style={{ ...s.input, fontSize: '0.7rem', padding: '2px 4px', color: '#888', flex: 1 }}
                    value={img.stopAmbient ? 'stop' : (img.ambientPlaylistId ? String(img.ambientPlaylistId) : '')}
                    onChange={(e) => setImageAmbientPlaylist.mutate({ id: img.id, value: e.target.value })}
                  >
                    <option value="">— No change</option>
                    <option value="stop">🔇 Stop</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {img.ambientPlaylistId && (() => { const pl = playlists.find((p) => p.id === img.ambientPlaylistId); return pl && pl.tracks.length > 0 ? <button style={{ ...s.btnIcon, color: '#7cb87c' }} title="Play ambient now" onClick={() => playAmbientPlaylist(pl)}>▶</button> : null; })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── EncounterCard ─────────────────────────────────────────────────────────────

function EncounterCard({
  encounter, allEncounters, playlists, scenes, onDelete, onInvalidate,
}: {
  encounter: Encounter;
  allEncounters: Encounter[];
  playlists: Playlist[];
  scenes: ImageScene[];
  onDelete: () => void;
  onInvalidate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isActive, setIsActive] = useState(() => !!localStorage.getItem(`gma:run:${encounter.id}`));
  const { playPlaylist, playAmbientPlaylist, stop, stopAmbient } = useAudio();
  const send = useBroadcastSender();
  const { playerImage, showImage } = usePlayerScreen();

  const updateEncounter = useMutation({
    mutationFn: async (body: { name: string; description: string }) => {
      const res = await fetch(`/api/encounters/${encounter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update encounter');
    },
    onSuccess: () => { onInvalidate(); setEditing(false); },
  });

  function startEditing() {
    setEditName(encounter.name);
    setEditDesc(encounter.description ?? '');
    setEditing(true);
  }

  const setEncounterPlaylist = useMutation({
    mutationFn: async (value: string) => {
      const body = value === 'stop'
        ? { playlistId: null, stopPlaylist: true }
        : { playlistId: value ? Number(value) : null, stopPlaylist: false };
      await fetch(`/api/encounters/${encounter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: onInvalidate,
  });

  const setEncounterAmbientPlaylist = useMutation({
    mutationFn: async (value: string) => {
      const body = value === 'stop'
        ? { ambientPlaylistId: null, stopAmbient: true }
        : { ambientPlaylistId: value ? Number(value) : null, stopAmbient: false };
      await fetch(`/api/encounters/${encounter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: onInvalidate,
  });

  function endEncounterFromHere() {
    localStorage.removeItem(`gma:run:${encounter.id}`);
    send({ type: 'TOGGLE_INITIATIVE', payload: { visible: false } });
    try {
      const raw = localStorage.getItem('gma:initiative');
      if (raw) localStorage.setItem('gma:initiative', JSON.stringify({ ...JSON.parse(raw), visible: false }));
    } catch {}
    if (playerImage) {
      showImage(playerImage.filePath, playerImage.fit);
      const img = scenes.flatMap((s) => s.images).find((i) => i.filePath === playerImage.filePath);
      const pl = img?.playlistId ? playlists.find((p) => p.id === img.playlistId) : null;
      if (pl && pl.tracks.length > 0) playPlaylist(pl);
      else if (img?.stopPlaylist) stop();
      const ambient = img?.ambientPlaylistId ? playlists.find((p) => p.id === img.ambientPlaylistId) : null;
      if (ambient && ambient.tracks.length > 0) playAmbientPlaylist(ambient);
      else if (img?.stopAmbient) stopAmbient();
    }
    setIsActive(false);
  }

  const activePlaylist = playlists.find((p) => p.id === encounter.playlistId) ?? null;

  return (
    <div style={{ ...s.sceneWrapper, ...(isActive ? { borderLeft: '3px solid #4caf50', paddingLeft: 8 } : {}) }}>
      <div style={s.card}>
        <span style={s.encounterDragHandle} title="Drag to reorder">⠿</span>
        <div style={s.cardBody}>
          {editing ? (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              onSubmit={(e) => { e.preventDefault(); if (editName.trim()) updateEncounter.mutate({ name: editName.trim(), description: editDesc.trim() }); }}
            >
              <input
                style={{ ...s.editInput, fontSize: '0.875rem' }}
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
                placeholder="Encounter name"
              />
              <textarea
                style={{ ...s.editInput, fontSize: '0.825rem', resize: 'vertical', minHeight: 52 }}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.btnSecondarySmall} type="submit" disabled={!editName.trim() || updateEncounter.isPending}>Save</button>
                <button style={s.btnGhost} type="button" onClick={() => setEditing(false)}>✕</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={s.cardTitle}>{encounter.name}</strong>
                {isActive && (
                  <span style={{ fontSize: '0.7rem', color: '#4caf50', border: '1px solid #3d6a3d', borderRadius: 10, padding: '1px 7px', fontWeight: 600, letterSpacing: '0.03em' }}>
                    ● Active
                  </span>
                )}
              </div>
              {encounter.description && <p style={s.cardDesc}>{encounter.description}</p>}
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', color: '#666' }}>🎵</span>
                <select
                  style={{ ...s.input, fontSize: '0.75rem', padding: '2px 6px', color: '#888' }}
                  value={encounter.stopPlaylist ? 'stop' : (encounter.playlistId ? String(encounter.playlistId) : '')}
                  onChange={(e) => setEncounterPlaylist.mutate(e.target.value)}
                >
                  <option value="">— No change</option>
                  <option value="stop">🔇 Stop</option>
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {activePlaylist && activePlaylist.tracks.length > 0 && (
                  <button style={{ ...s.btnIcon, color: '#c9a84c' }} title="Play playlist now" onClick={() => playPlaylist(activePlaylist)}>▶</button>
                )}
              </div>
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', color: '#666' }}>🌿</span>
                <select
                  style={{ ...s.input, fontSize: '0.75rem', padding: '2px 6px', color: '#888' }}
                  value={encounter.stopAmbient ? 'stop' : (encounter.ambientPlaylistId ? String(encounter.ambientPlaylistId) : '')}
                  onChange={(e) => setEncounterAmbientPlaylist.mutate(e.target.value)}
                >
                  <option value="">— No change</option>
                  <option value="stop">🔇 Stop</option>
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {(() => { const pl = playlists.find((p) => p.id === encounter.ambientPlaylistId); return pl && pl.tracks.length > 0 ? <button style={{ ...s.btnIcon, color: '#7cb87c' }} title="Play ambient now" onClick={() => playAmbientPlaylist(pl)}>▶</button> : null; })()}
              </div>
            </>
          )}
        </div>
        <div style={s.cardRight}>
          <span style={s.badge}>{encounter.combatants.length} combatants</span>
          <Link
            to="/run/$encounterId"
            params={{ encounterId: String(encounter.id) }}
            style={s.btnRun}
          >
            {isActive ? '▶ Continue' : '▶ Run'}
          </Link>
          {isActive && (
            <button style={{ ...s.btnSecondarySmall, color: '#ef5350', borderColor: '#ef5350' }} onClick={endEncounterFromHere}>
              End
            </button>
          )}
          <a
            href={`/api/export/encounter/${encounter.id}`}
            download
            style={{ ...s.btnSecondarySmall, textDecoration: 'none' } as React.CSSProperties}
            title="Export encounter"
          >↓ Export Encounter</a>
          <button style={s.btnSecondarySmall} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Close' : 'Manage'}
          </button>
          <button style={s.btnIcon} onClick={startEditing} title="Edit encounter">✎</button>
          <button style={{ ...s.btnIcon, color: '#ef5350' }} onClick={onDelete} title="Delete encounter">🗑</button>
        </div>
      </div>
      {expanded && (
        <CombatantManager encounter={encounter} otherEncounters={allEncounters.filter((e) => e.id !== encounter.id)} onInvalidate={onInvalidate} />
      )}
    </div>
  );
}

// ── CombatantManager ──────────────────────────────────────────────────────────

function hasLairFlag(statBlock: string | null | undefined): boolean {
  if (!statBlock) return false;
  try {
    return JSON.parse(statBlock).has_lair === true;
  } catch {
    return false;
  }
}

function CombatantManager({ encounter, otherEncounters, onInvalidate }: { encounter: Encounter; otherEncounters: { id: number; name: string }[]; onInvalidate: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copyMenuId, setCopyMenuId] = useState<number | null>(null);
  const [statBlockEditId, setStatBlockEditId] = useState<number | null>(null);
  const send = useBroadcastSender();

  const addCombatant = useMutation({
    mutationFn: async (body: { name: string; maxHp: number; initiativeModifier: number; type: Combatant['type']; color: string; description: string | null; visibleToPlayers: boolean; statBlock?: string; members?: { label: string; maxHp: number }[] }) => {
      const res = await fetch('/api/encounters/combatants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: encounter.id, ...body }),
      });
      if (!res.ok) throw new Error('Failed to add combatant');
      return res.json() as Promise<Combatant & { members?: { id: number; label: string; maxHp: number }[] }>;
    },
    onSuccess: (created) => {
      onInvalidate();
      setShowForm(false);
      send({ type: 'COMBATANT_ADDED', payload: { encounterId: encounter.id, combatant: { id: created.id, name: created.name, maxHp: created.maxHp, initiativeModifier: created.initiativeModifier, type: created.type, color: created.color, description: created.description, visibleToPlayers: created.visibleToPlayers, statBlock: created.statBlock ?? null, ...(created.members ? { members: created.members } : {}) } } });
    },
  });

  const updateCombatant = useMutation({
    mutationFn: async (body: { id: number; name: string; maxHp: number; initiativeModifier: number; type: Combatant['type']; color: string; description: string | null; visibleToPlayers: boolean; statBlock?: string; members?: { label: string; maxHp: number }[] }) => {
      const res = await fetch(`/api/encounters/combatants/${body.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: body.name, maxHp: body.maxHp, initiativeModifier: body.initiativeModifier, type: body.type, color: body.color, description: body.description, visibleToPlayers: body.visibleToPlayers, statBlock: body.statBlock, ...(body.members ? { members: body.members } : {}) }),
      });
      if (!res.ok) throw new Error('Failed to update combatant');
      return res.json() as Promise<Combatant & { members?: { id: number; label: string; maxHp: number }[] }>;
    },
    onSuccess: (updated) => {
      onInvalidate();
      setEditingId(null);
      send({ type: 'COMBATANT_UPDATED', payload: { encounterId: encounter.id, combatant: { id: updated.id, name: updated.name, maxHp: updated.maxHp, initiativeModifier: updated.initiativeModifier, type: updated.type, color: updated.color, ...(updated.members ? { members: updated.members } : {}) } } });
    },
  });

  const removeCombatant = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/encounters/combatants/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      onInvalidate();
      send({ type: 'COMBATANT_REMOVED', payload: { encounterId: encounter.id, combatantId: id } });
    },
  });

  const toggleInLair = useMutation({
    mutationFn: async ({ id, inLair }: { id: number; inLair: boolean }) => {
      const res = await fetch(`/api/encounters/combatants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inLair }),
      });
      if (!res.ok) throw new Error('Failed to update combatant');
      return res.json() as Promise<Combatant>;
    },
    onSuccess: () => onInvalidate(),
  });

  const copyCombatant = useMutation({
    mutationFn: async ({ combatant, targetEncounterId }: { combatant: Combatant; targetEncounterId: number }) => {
      const res = await fetch('/api/encounters/combatants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId: targetEncounterId,
          name: combatant.name,
          maxHp: combatant.maxHp,
          initiativeModifier: combatant.initiativeModifier,
          type: combatant.type,
          color: combatant.color,
          description: combatant.description,
          visibleToPlayers: combatant.visibleToPlayers,
          statBlock: combatant.statBlock,
          members: combatant.members?.map((m) => ({ label: m.label, maxHp: m.maxHp })),
        }),
      });
      if (!res.ok) throw new Error('Failed to copy combatant');
    },
    onSuccess: () => onInvalidate(),
  });

  return (
    <div style={s.sceneDetail}>
      {encounter.combatants.length === 0 && !showForm && (
        <p style={s.muted}>No combatants yet.</p>
      )}

      {encounter.combatants.map((c) => (
        editingId === c.id ? (
          <CombatantForm
            key={c.id}
            initialValues={c}
            onSubmit={(v) => updateCombatant.mutate({ id: c.id, ...v })}
            pending={updateCombatant.isPending}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={c.id} style={{ marginBottom: 4 }}>
            <div style={{ ...s.combatantRow, flexWrap: 'wrap' as const }}>
              {c.color && <span style={{ ...s.colorDot, background: c.color }} />}
              <span style={s.combatantName}>{c.name}</span>
              {c.type !== 'group' && c.type !== 'event' && c.type !== 'lair' && <span style={s.combatantStat}>HP {c.maxHp}</span>}
              <span style={s.combatantStat}>
                Init {c.initiativeModifier >= 0 ? `+${c.initiativeModifier}` : c.initiativeModifier}
              </span>
              <span style={{ ...s.typeBadge, ...typeStyle(c.type) }}>{c.type === 'lair' ? 'lair action' : c.type}</span>
              {(c.type === 'event' || c.type === 'lair') && c.description && (
                <span style={{ width: '100%', fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic', paddingLeft: 18, marginTop: 2 }}>
                  {c.description}
                </span>
              )}
              <button
                style={{ ...s.btnIcon, color: c.visibleToPlayers ? '#4caf50' : '#555' }}
                title={c.visibleToPlayers ? 'Visible to players (click to hide)' : 'Hidden from players (click to show)'}
                onClick={() => updateCombatant.mutate({ id: c.id, name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier, type: c.type, color: c.color ?? defaultColor(c.type), description: c.description, visibleToPlayers: !c.visibleToPlayers, statBlock: c.statBlock ?? undefined, ...(c.type === 'group' && c.members ? { members: c.members.map((m) => ({ label: m.label, maxHp: m.maxHp })) } : {}) })}
              >👁</button>
              {hasLairFlag(c.statBlock) && (
                <button
                  style={{ ...s.btnIcon, color: c.inLair ? '#e0a84c' : '#555' }}
                  title={c.inLair ? 'In its lair (+1 legendary action & resistance) — click to leave' : 'Not in its lair — click to mark as in lair'}
                  onClick={() => toggleInLair.mutate({ id: c.id, inLair: !c.inLair })}
                >🏰</button>
              )}
              {(c.type === 'enemy' || c.type === 'group') && (
                <button
                  style={{ ...s.btnIcon, color: '#ce93d8' }}
                  title={c.type === 'enemy' ? 'Convert to group with 2 members' : 'Add another member'}
                  onClick={() => {
                    if (c.type === 'enemy') {
                      updateCombatant.mutate({ id: c.id, name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier, type: 'group', color: c.color ?? defaultColor(c.type), description: c.description, visibleToPlayers: c.visibleToPlayers, statBlock: c.statBlock ?? undefined, members: [{ label: `${c.name} (1)`, maxHp: c.maxHp }, { label: `${c.name} (2)`, maxHp: c.maxHp }] });
                    } else {
                      const existing = c.members ?? [];
                      const lastHp = existing.length > 0 ? existing[existing.length - 1].maxHp : 10;
                      updateCombatant.mutate({ id: c.id, name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier, type: 'group', color: c.color ?? defaultColor(c.type), description: c.description, visibleToPlayers: c.visibleToPlayers, statBlock: c.statBlock ?? undefined, members: [...existing.map(m => ({ label: m.label, maxHp: m.maxHp })), { label: `${c.name} (${existing.length + 1})`, maxHp: lastHp }] });
                    }
                  }}
                >+</button>
              )}
              {c.type !== 'event' && c.type !== 'lair' && c.type !== 'pc' && (
                <button
                  style={{ ...s.btnIcon, color: c.statBlock ? '#c9a84c' : '#555' }}
                  onClick={() => setStatBlockEditId(statBlockEditId === c.id ? null : c.id)}
                  title={c.statBlock ? 'Edit stat block' : 'Add stat block'}
                >📖</button>
              )}
              <button style={s.btnIcon} onClick={() => setEditingId(c.id)} title="Edit">✎</button>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button style={s.btnIcon} title="Copy combatant" onClick={() => setCopyMenuId(copyMenuId === c.id ? null : c.id)}>⧉</button>
                {copyMenuId === c.id && (
                  <div
                    style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, background: '#1a1a2e', border: '1px solid #333', borderRadius: 6, minWidth: 190, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', padding: '4px 0' }}
                    onMouseLeave={() => setCopyMenuId(null)}
                  >
                    <button
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', color: '#e0e0e0', cursor: 'pointer', fontSize: '0.82rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4a')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => { copyCombatant.mutate({ combatant: c, targetEncounterId: encounter.id }); setCopyMenuId(null); }}
                    >📋 Copy to this encounter</button>
                    {otherEncounters.length > 0 && (
                      <>
                        <div style={{ borderTop: '1px solid #333', margin: '4px 0' }} />
                        {otherEncounters.map((e) => (
                          <button
                            key={e.id}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.background = '#2a2a4a')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.background = 'none')}
                            onClick={() => { copyCombatant.mutate({ combatant: c, targetEncounterId: e.id }); setCopyMenuId(null); }}
                            title={`Copy to: ${e.name}`}
                          >↗ {e.name}</button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <button style={{ ...s.btnIcon, color: '#ef5350' }} onClick={() => removeCombatant.mutate(c.id)} title="Remove combatant">🗑</button>
            </div>
            {statBlockEditId === c.id && (
              <StatBlockEditor
                initialData={c.statBlock ?? undefined}
                onSave={(json) => {
                  updateCombatant.mutate({ id: c.id, name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier, type: c.type, color: c.color ?? defaultColor(c.type), description: c.description, visibleToPlayers: c.visibleToPlayers, statBlock: json, ...(c.type === 'group' && c.members ? { members: c.members.map((m) => ({ label: m.label, maxHp: m.maxHp })) } : {}) });
                  setStatBlockEditId(null);
                }}
                onCancel={() => setStatBlockEditId(null)}
              />
            )}
            {c.type === 'group' && c.members && c.members.length > 0 && (
              <div style={{ paddingLeft: 18, display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {c.members.map((m) => (
                  <span key={m.id} style={s.memberChip}>
                    <MemberLabelChip memberId={m.id} label={m.label} onSaved={onInvalidate} />
                    <span style={{ opacity: 0.7 }}> HP {m.maxHp}</span>
                    <button
                      style={{ background: 'none', border: 'none', color: '#e05c5c', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px', lineHeight: 1 }}
                      title="Remove member"
                      onClick={async () => {
                        await fetch(`/api/encounters/combatants/group-members/${m.id}`, { method: 'DELETE' });
                        onInvalidate();
                      }}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      ))}

      {showForm ? (
        <CombatantForm
          onSubmit={(v) => addCombatant.mutate(v)}
          pending={addCombatant.isPending}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button style={{ ...s.btnSecondarySmall, marginTop: 8 }} onClick={() => setShowForm(true)}>
          + Add Combatant
        </button>
      )}
    </div>
  );
}

// ── MemberLabelChip ───────────────────────────────────────────────────────────

function MemberLabelChip({ memberId, label, onSaved }: { memberId: number; label: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) {
      await fetch(`/api/encounters/combatants/group-members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      });
      onSaved();
    } else {
      setDraft(label);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        style={{ fontSize: '0.75rem', background: '#1a1a2e', border: '1px solid #444', color: '#ddd', borderRadius: 3, padding: '1px 4px', width: 100 }}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(label); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      style={{ cursor: 'pointer' }}
      onClick={() => { setDraft(label); setEditing(true); }}
      title="Click to rename"
    >{label}</span>
  );
}

function defaultColor(type: string): string {
  if (type === 'pc') return '#4caf50';
  if (type === 'enemy' || type === 'group') return '#ef5350';
  return '#888888';
}

// ── CombatantForm ─────────────────────────────────────────────────────────────

function CombatantForm({
  onSubmit, pending, onCancel, initialValues,
}: {
  onSubmit: (v: { name: string; maxHp: number; initiativeModifier: number; type: Combatant['type']; color: string; description: string | null; visibleToPlayers: boolean; statBlock?: string; members?: { label: string; maxHp: number }[] }) => void;
  pending: boolean;
  onCancel: () => void;
  initialValues?: { name: string; maxHp: number; initiativeModifier: number; type: Combatant['type']; color: string | null; description?: string | null; visibleToPlayers?: boolean; statBlock?: string | null; members?: { id: number; label: string; maxHp: number }[] };
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [maxHp, setMaxHp] = useState(initialValues?.maxHp ?? 10);
  const [initMod, setInitMod] = useState(initialValues?.initiativeModifier ?? 0);
  const [type, setType] = useState<Combatant['type']>(initialValues?.type ?? 'enemy');
  const [color, setColor] = useState(initialValues?.color ?? defaultColor(initialValues?.type ?? 'enemy'));
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [visibleToPlayers, setVisibleToPlayers] = useState(
    initialValues?.visibleToPlayers ?? (initialValues?.type === 'event' || initialValues?.type === 'lair' ? false : true)
  );
  const [members, setMembers] = useState<{ label: string; maxHp: number }[]>(
    initialValues?.members?.map((m) => ({ label: m.label, maxHp: m.maxHp })) ?? []
  );
  const [pendingStatBlock, setPendingStatBlock] = useState<string | undefined>(initialValues?.statBlock ?? undefined);
  const [showSbEditor, setShowSbEditor] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function saveToLibrary() {
    if (!name.trim()) return;
    await fetch('/api/monsters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), maxHp, initiativeModifier: initMod, statBlock: pendingStatBlock ?? null }),
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === 'group' && members.length === 0) return;
    const computedMaxHp = type === 'group' ? members.reduce((s, m) => s + m.maxHp, 0) : maxHp;
    const isGmOnly = type === 'event' || type === 'lair';
    onSubmit({ name: name.trim(), maxHp: computedMaxHp, initiativeModifier: initMod, type, color, description: description.trim() || null, visibleToPlayers: isGmOnly ? false : visibleToPlayers, statBlock: pendingStatBlock, ...(type === 'group' ? { members } : {}) });
  }

  function addMember() {
    setMembers((prev) => [...prev, { label: '', maxHp: 10 }]);
  }

  function updateMember(i: number, field: 'label' | 'maxHp', value: string | number) {
    setMembers((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }

  function removeMember(i: number) {
    setMembers((prev) => prev.filter((_, idx) => idx !== i));
  }

  const isGroupInvalid = type === 'group' && members.length === 0;

  return (
    <form style={{ ...s.form, marginTop: 8 }} onSubmit={handleSubmit}>
      {!initialValues && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Open5eSearch
            onSelect={(m) => { setName(m.name); setMaxHp(m.maxHp); setInitMod(m.initiativeModifier); setType('enemy'); setPendingStatBlock(m.statBlock); }}
          />
          <MonsterLibrary
            onSelect={(m) => { setName(m.name); setMaxHp(m.maxHp); setInitMod(m.initiativeModifier); setType('enemy'); setPendingStatBlock(m.statBlock); }}
          />
        </div>
      )}
      <div style={s.formRow}>
        <input style={{ ...s.input, flex: 2 }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {type !== 'group' && type !== 'event' && type !== 'lair' && (
          <label style={s.formLabel}>
            HP
            <input style={{ ...s.input, width: 72 }} type="number" min={1} value={maxHp} onChange={(e) => setMaxHp(Number(e.target.value))} />
          </label>
        )}
        <label style={s.formLabel}>
          Init mod
          <input style={{ ...s.input, width: 64 }} type="number" value={initMod} onChange={(e) => setInitMod(Number(e.target.value))} />
        </label>
      </div>
      <div style={s.formRow}>
        <select style={s.input} value={type} onChange={(e) => { const t = e.target.value as Combatant['type']; setType(t); setColor(defaultColor(t)); }}>
          <option value="enemy">Enemy</option>
          <option value="npc">NPC</option>
          <option value="pc">PC</option>
          <option value="group">Group</option>
          <option value="event">Event</option>
          <option value="lair">Lair Action</option>
        </select>
        <label style={s.formLabel}>
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
        </label>
        <label style={s.formLabel}>
          Visible
          <button
            type="button"
            style={{ ...s.btnIcon, color: visibleToPlayers ? '#4caf50' : '#555', height: 32 }}
            title={visibleToPlayers ? 'Visible to players' : 'Hidden from players'}
            onClick={() => setVisibleToPlayers((v) => !v)}
          >👁</button>
        </label>
        <button style={s.btnPrimary} type="submit" disabled={pending || !name.trim() || isGroupInvalid}>
          {pending ? (initialValues ? 'Saving...' : 'Adding...') : (initialValues ? 'Save' : 'Add Combatant')}
        </button>
        {type !== 'event' && type !== 'lair' && (
          <button
            type="button"
            style={{ ...s.btnSecondary, color: pendingStatBlock ? '#c9a84c' : '#666', borderColor: pendingStatBlock ? '#c9a84c' : '#444' }}
            onClick={() => setShowSbEditor(true)}
            title={pendingStatBlock ? 'Edit stat block' : 'Create stat block'}
          >
            📖 {pendingStatBlock ? 'Edit Stat Block' : 'Stat Block'}
          </button>
        )}
        {type !== 'event' && type !== 'lair' && (
          <button
            type="button"
            style={{ ...s.btnSecondary, color: justSaved ? '#4caf50' : '#666' }}
            onClick={saveToLibrary}
            disabled={!name.trim()}
            title="Save this monster to the library for reuse"
          >
            {justSaved ? '✓ Saved' : '💾 Save to Library'}
          </button>
        )}
        <button style={s.btnSecondary} type="button" onClick={onCancel}>Cancel</button>
      </div>
      {showSbEditor && (
        <StatBlockEditor
          initialData={pendingStatBlock}
          onSave={(json) => { setPendingStatBlock(json); setShowSbEditor(false); }}
          onCancel={() => setShowSbEditor(false)}
        />
      )}
      {(type === 'event' || type === 'lair') ? (
        <textarea
          style={{ ...s.input, minHeight: 72, resize: 'vertical', marginTop: 4 }}
          placeholder="Description (GM only — what happens when this triggers)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : (type === 'enemy' || type === 'group' || type === 'npc') ? (
        <textarea
          style={{ ...s.input, minHeight: 60, resize: 'vertical', marginTop: 4 }}
          placeholder="Notes (GM only — tactics, abilities, reminders)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : null}
      {type === 'group' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>Members ({members.length})</span>
            <button type="button" style={s.btnSecondarySmall} onClick={addMember}>+ Add Member</button>
          </div>
          {members.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <input
                style={{ ...s.input, width: 80 }}
                placeholder="Label"
                value={m.label}
                onChange={(e) => updateMember(i, 'label', e.target.value)}
              />
              <label style={s.formLabel}>
                HP
                <input
                  style={{ ...s.input, width: 64 }}
                  type="number"
                  min={1}
                  value={m.maxHp}
                  onChange={(e) => updateMember(i, 'maxHp', Number(e.target.value))}
                />
              </label>
              <button type="button" style={{ ...s.btnIcon, color: '#ef5350' }} onClick={() => removeMember(i)} title="Remove member">🗑</button>
            </div>
          ))}
          {members.length === 0 && <p style={{ ...s.muted, fontSize: '0.75rem' }}>Add at least one member.</p>}
        </div>
      )}
    </form>
  );
}

function PlayerForm({
  onSubmit, pending, onCancel, initialValues,
}: {
  onSubmit: (v: { name: string; maxHp: number; initiativeModifier: number; color: string; armorClass: number | null; spellDc: number | null; passivePerception: number | null }) => void;
  pending: boolean;
  onCancel: () => void;
  initialValues?: { name: string; maxHp: number; initiativeModifier: number; color: string | null; armorClass?: number | null; spellDc?: number | null; passivePerception?: number | null };
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [maxHp, setMaxHp] = useState(initialValues?.maxHp ?? 10);
  const [initMod, setInitMod] = useState(initialValues?.initiativeModifier ?? 0);
  const [color, setColor] = useState(initialValues?.color ?? '#4caf50');
  const [armorClass, setArmorClass] = useState(initialValues?.armorClass != null ? String(initialValues.armorClass) : '');
  const [spellDc, setSpellDc] = useState(initialValues?.spellDc != null ? String(initialValues.spellDc) : '');
  const [passivePerception, setPassivePerception] = useState(initialValues?.passivePerception != null ? String(initialValues.passivePerception) : '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(), maxHp, initiativeModifier: initMod, color,
      armorClass: armorClass !== '' ? Number(armorClass) : null,
      spellDc: spellDc !== '' ? Number(spellDc) : null,
      passivePerception: passivePerception !== '' ? Number(passivePerception) : null,
    });
  }

  return (
    <form style={{ ...s.form, marginTop: 8 }} onSubmit={handleSubmit}>
      <div style={s.formRow}>
        <input style={{ ...s.input, flex: 2 }} placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label style={s.formLabel}>
          Max HP
          <input style={{ ...s.input, width: 72 }} type="number" min={1} value={maxHp} onChange={(e) => setMaxHp(Number(e.target.value))} />
        </label>
        <label style={s.formLabel}>
          Init mod
          <input style={{ ...s.input, width: 64 }} type="number" value={initMod} onChange={(e) => setInitMod(Number(e.target.value))} />
        </label>
        <label style={s.formLabel}>
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
        </label>
      </div>
      <div style={s.formRow}>
        <label style={s.formLabel}>
          Armor Class
          <input style={{ ...s.input, width: 72 }} type="number" min={1} placeholder="—" value={armorClass} onChange={(e) => setArmorClass(e.target.value)} />
        </label>
        <label style={s.formLabel}>
          Spell DC
          <input style={{ ...s.input, width: 72 }} type="number" min={1} placeholder="—" value={spellDc} onChange={(e) => setSpellDc(e.target.value)} />
        </label>
        <label style={s.formLabel}>
          Passive Perception
          <input style={{ ...s.input, width: 80 }} type="number" min={1} placeholder="—" value={passivePerception} onChange={(e) => setPassivePerception(e.target.value)} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.btnPrimary} type="submit" disabled={pending || !name.trim()}>
          {pending ? 'Saving...' : initialValues ? 'Save' : 'Add Player'}
        </button>
        <button style={s.btnSecondary} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function typeStyle(type: Combatant['type']): React.CSSProperties {
  if (type === 'pc') return { background: '#1a3a1a', color: '#4caf50', borderColor: '#2d5a2d' };
  if (type === 'npc') return { background: '#1a2a3a', color: '#64b5f6', borderColor: '#1e3a5a' };
  if (type === 'group') return { background: '#2a1a3a', color: '#ce93d8', borderColor: '#4a2a5a' };
  if (type === 'event') return { background: '#2a2a1a', color: '#ffd54f', borderColor: '#4a4a1e' };
  if (type === 'lair') return { background: '#1a2a2a', color: '#80cbc4', borderColor: '#1e4a4a' };
  return { background: '#3a1a1a', color: '#ef5350', borderColor: '#5a1e1e' };
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Section({
  title, count, addLabel, addForm, children, headerActions,
}: {
  title: string;
  count: number;
  addLabel: string;
  addForm: (close: () => void) => React.ReactNode;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section style={s.section}>
      <div style={s.sectionHeader}>
        <h2 style={s.sectionTitle}>{title} ({count})</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {headerActions}
          <button style={s.btnPrimary} onClick={() => setOpen((v) => !v)}>
            {open ? 'Cancel' : addLabel}
          </button>
        </div>
      </div>
      {open && addForm(() => setOpen(false))}
      {children}
      {count === 0 && !open && <p style={s.muted}>None yet.</p>}
    </section>
  );
}

function SimpleNameForm({
  placeholder, submitLabel, onSubmit, pending, onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <form style={s.form} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
      <input style={s.input} placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.btnPrimary} type="submit" disabled={pending || !name.trim()}>
          {pending ? 'Adding...' : submitLabel}
        </button>
        <button style={s.btnSecondary} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function EncounterForm({
  onSubmit, pending, onCancel,
}: {
  onSubmit: (v: { name: string; description: string }) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <form style={s.form} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit({ name: name.trim(), description: desc.trim() }); }}>
      <input style={s.input} placeholder="Encounter name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <textarea
        style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.btnPrimary} type="submit" disabled={pending || !name.trim()}>
          {pending ? 'Adding...' : 'Add Encounter'}
        </button>
        <button style={s.btnSecondary} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', paddingBottom: 60 },
  back: { color: '#c9a84c', textDecoration: 'none', fontSize: '0.875rem', whiteSpace: 'nowrap' },
  title: { margin: 0, fontSize: '1.5rem', color: '#c9a84c' },
  main: { padding: '32px', maxWidth: 900, margin: '0 auto' },
  desc: { color: '#999', marginBottom: 32 },
  section: { marginBottom: 48 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { margin: 0, fontSize: '1.1rem' },
  form: {
    display: 'flex', flexDirection: 'column', gap: 8,
    marginBottom: 16, padding: 16, background: '#16213e',
    borderRadius: 8, border: '1px solid #2a2a4a',
  },
  input: {
    background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '8px 12px', fontSize: '1rem',
  },
  card: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, background: '#16213e', border: '1px solid #2a2a4a',
    borderRadius: 8, marginBottom: 2,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: '1rem' },
  cardDesc: { margin: '4px 0 0', fontSize: '0.8rem', color: '#999' },
  cardRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  sceneWrapper: { marginBottom: 8 },
  sceneDetail: {
    background: '#0f0f1f', border: '1px solid #2a2a4a', borderTop: 'none',
    borderRadius: '0 0 8px 8px', padding: 16,
  },
  sceneToolbar: { display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8,
  },
  imageTileWrapper: {
    display: 'flex', flexDirection: 'column' as const, gap: 4,
  },
  imageTile: {
    position: 'relative', borderRadius: 6, overflow: 'hidden',
    aspectRatio: '16/9', background: '#1a1a2e', cursor: 'pointer',
  },
  thumbnail: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  dragHandle: {
    position: 'absolute' as const, top: 4, left: 4,
    color: 'rgba(255,255,255,0.5)', fontSize: '1rem', lineHeight: 1,
    cursor: 'grab', userSelect: 'none' as const, zIndex: 10,
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  tileOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 6, opacity: 0,
    transition: 'opacity 0.15s',
    // CSS :hover can't be done inline — see note below
  },
  tileBtn: {
    background: '#c9a84c', color: '#1a1a2e', border: 'none',
    padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
    fontWeight: 700, fontSize: '0.8rem',
  },
  tileActions: { display: 'flex', gap: 4 },
  tileIconBtn: {
    background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
    width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
    fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fitToggle: { display: 'flex', gap: 2 },
  fitBtn: {
    padding: '3px 7px', background: 'transparent', color: '#666',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.7rem', textTransform: 'capitalize' as const,
  },
  fitBtnActive: {
    padding: '3px 7px', background: '#1a2a3a', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.7rem', textTransform: 'capitalize' as const,
  },
  badge: {
    fontSize: '0.75rem', color: '#999', background: '#2a2a4a',
    padding: '2px 8px', borderRadius: 12,
  },
  muted: { color: '#666', fontStyle: 'italic' },
  btnPrimary: {
    padding: '8px 16px', background: '#c9a84c', color: '#1a1a2e',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
    fontSize: '0.875rem',
  },
  btnSecondary: {
    padding: '8px 16px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnGhost: {
    padding: '6px 12px', background: 'transparent', color: '#666',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem',
  },
  editInput: {
    background: '#1a1a2e', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '6px 10px',
  },
  btnDanger: {
    padding: '8px 16px', background: 'transparent', color: '#ef5350',
    border: '1px solid #ef5350', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnActive: {
    padding: '8px 16px', background: '#2d4a2d', color: '#4caf50',
    border: '1px solid #3d6a3d', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600,
  },
  btnSecondarySmall: {
    padding: '5px 10px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.8rem',
  },
  btnIcon: {
    padding: '4px 8px', background: 'transparent', color: '#888',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.75rem',
  },
  btnRun: {
    padding: '5px 12px', background: '#2d4a2d', color: '#4caf50',
    border: '1px solid #3d6a3d', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
  },
  combatantRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', background: '#1a1a2e',
    borderRadius: 4, marginBottom: 4,
  },
  colorDot: {
    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
  },
  combatantName: { flex: 1, fontSize: '0.95rem' },
  combatantStat: { fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' },
  playerStat: { fontSize: '0.85rem', color: '#e0e0e0', whiteSpace: 'nowrap' },
  typeBadge: {
    fontSize: '0.7rem', padding: '1px 6px', borderRadius: 10,
    border: '1px solid', textTransform: 'capitalize' as const, flexShrink: 0,
  },
  formRow: { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' as const },
  formLabel: { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: '0.75rem', color: '#888' },
  memberChip: {
    fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10,
    background: '#2a1a3a', color: '#ce93d8', border: '1px solid #4a2a5a',
  },
  encounterDragHandle: {
    color: 'rgba(255,255,255,0.25)', fontSize: '1rem', cursor: 'grab',
    userSelect: 'none', flexShrink: 0, padding: '0 6px 0 0',
  },
};
