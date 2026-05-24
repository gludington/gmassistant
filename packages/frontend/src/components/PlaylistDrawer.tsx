import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAudio, type Playlist, type PlaylistTrack } from '../hooks/useAudio';

// ── PlaylistDrawer ────────────────────────────────────────────────────────────

export function PlaylistDrawer({
  adventureId,
  onClose,
  onInvalidate,
}: {
  adventureId: number;
  onClose: () => void;
  onInvalidate?: () => void;
}) {
  const queryClient = useQueryClient();
  const { currentPlaylist, playPlaylist } = useAudio();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addingTrackId, setAddingTrackId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ['playlists-drawer', adventureId],
    queryFn: async () => {
      const res = await fetch(`/api/playlists?adventureId=${adventureId}`);
      return res.json();
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['playlists-drawer', adventureId] });
    onInvalidate?.();
  }

  const createPlaylist = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) return;
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId, name: newName.trim(), sortOrder: playlists.length }),
      });
    },
    onSuccess: () => { invalidate(); setNewName(''); setShowNewForm(false); },
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/playlists/${id}`, { method: 'DELETE' }); },
    onSuccess: invalidate,
  });

  const setPlayMode = useMutation({
    mutationFn: async ({ id, playMode }: { id: number; playMode: 'sequential' | 'shuffle' }) => {
      await fetch(`/api/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playMode }),
      });
    },
    onSuccess: invalidate,
  });

  const deleteTrack = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/playlists/tracks/${id}`, { method: 'DELETE' }); },
    onSuccess: invalidate,
  });

  const reorderTracks = useMutation({
    mutationFn: async (ordered: PlaylistTrack[]) => {
      await Promise.all(
        ordered.map((track, i) =>
          fetch(`/api/playlists/tracks/${track.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: track.name, type: track.type, url: track.url, sortOrder: i }),
          })
        )
      );
    },
    onSuccess: invalidate,
  });

  return (
    <div style={s.drawer}>
      {/* Header */}
      <div style={s.drawerHeader}>
        <span style={s.drawerTitle}>🎵 Playlists</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={s.newBtn} onClick={() => setShowNewForm((v) => !v)}>+ New</button>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* New playlist form */}
      {showNewForm && (
        <form
          style={s.newForm}
          onSubmit={(e) => { e.preventDefault(); createPlaylist.mutate(); }}
        >
          <input
            style={s.input}
            placeholder="Playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button style={s.btnPrimary} type="submit" disabled={!newName.trim() || createPlaylist.isPending}>
              Add
            </button>
            <button style={s.btnGhost} type="button" onClick={() => setShowNewForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div style={s.list}>
        {playlists.length === 0 && !showNewForm && (
          <p style={s.muted}>No playlists yet. Click "+ New" to create one.</p>
        )}
        {playlists.map((pl) => {
          const isPlaying = currentPlaylist?.id === pl.id;
          const isExpanded = expandedId === pl.id;
          return (
            <div key={pl.id} style={{ ...s.card, ...(isPlaying ? s.cardPlaying : {}) }}>
              <div style={s.cardRow}>
                {isPlaying && <span style={s.playingPip} />}
                <div style={s.cardInfo}>
                  <span style={s.plName}>{pl.name}</span>
                  <span style={s.trackCount}>
                    {pl.tracks.length} track{pl.tracks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={s.cardActions}>
                  <button
                    style={{ ...s.modeBtn, color: pl.playMode === 'shuffle' ? '#c9a84c' : '#555' }}
                    onClick={() => setPlayMode.mutate({ id: pl.id, playMode: pl.playMode === 'shuffle' ? 'sequential' : 'shuffle' })}
                    title={pl.playMode === 'shuffle' ? 'Shuffle (click for sequential)' : 'Sequential (click for shuffle)'}
                  >{pl.playMode === 'shuffle' ? '🔀' : '↕'}</button>
                  {pl.tracks.length > 0 && (
                    <button
                      style={{ ...s.iconBtn, color: isPlaying ? '#c9a84c' : '#aaa' }}
                      onClick={() => playPlaylist(pl)}
                      title={isPlaying ? 'Now playing' : 'Play'}
                    >▶</button>
                  )}
                  <button
                    style={{ ...s.iconBtn, color: isExpanded ? '#c9a84c' : '#555' }}
                    onClick={() => setExpandedId(isExpanded ? null : pl.id)}
                    title={isExpanded ? 'Collapse' : 'Manage tracks'}
                  >{isExpanded ? '▲' : '▼'}</button>
                  <a
                    href={`/api/export/playlist/${pl.id}`}
                    download
                    style={{ ...s.iconBtn, color: '#555', textDecoration: 'none' } as React.CSSProperties}
                    title="Export playlist"
                  >↓</a>
                  <button
                    style={{ ...s.iconBtn, color: '#444' }}
                    onClick={() => { if (confirm(`Delete "${pl.name}"?`)) deletePlaylist.mutate(pl.id); }}
                    title="Delete playlist"
                  >✕</button>
                </div>
              </div>

              {isExpanded && (
                <div style={s.trackSection}>
                  <TrackList
                    tracks={pl.tracks}
                    onDelete={(id) => deleteTrack.mutate(id)}
                    onReorder={(ordered) => reorderTracks.mutate(ordered)}
                  />
                  {addingTrackId === pl.id ? (
                    <AddTrackForm
                      playlistId={pl.id}
                      onSuccess={() => { invalidate(); setAddingTrackId(null); }}
                      onCancel={() => setAddingTrackId(null)}
                    />
                  ) : (
                    <button
                      style={s.addTrackBtn}
                      onClick={() => setAddingTrackId(pl.id)}
                    >+ Add Track</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TrackList ─────────────────────────────────────────────────────────────────

function TrackList({ tracks, onDelete, onReorder }: {
  tracks: PlaylistTrack[];
  onDelete: (id: number) => void;
  onReorder: (ordered: PlaylistTrack[]) => void;
}) {
  const [localTracks, setLocalTracks] = useState<PlaylistTrack[]>(tracks);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const lastOverIdRef = useRef<number | null>(null);
  const droppedRef = useRef(false);

  useEffect(() => {
    if (draggingId === null) setLocalTracks(tracks);
  }, [tracks]);

  function handleDragStart(id: number) {
    droppedRef.current = false;
    lastOverIdRef.current = null;
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    if (draggingId === null || draggingId === id || lastOverIdRef.current === id) return;
    lastOverIdRef.current = id;
    setLocalTracks((prev) => {
      const from = prev.findIndex((t) => t.id === draggingId);
      const to = prev.findIndex((t) => t.id === id);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function handleDrop() {
    droppedRef.current = true;
    setDraggingId(null);
    onReorder(localTracks);
  }

  function handleDragEnd() {
    if (!droppedRef.current) setLocalTracks(tracks);
    droppedRef.current = false;
    setDraggingId(null);
  }

  if (localTracks.length === 0) {
    return <p style={{ ...s.muted, fontSize: '0.75rem', margin: '4px 0 8px' }}>No tracks yet.</p>;
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {localTracks.map((track) => (
        <div
          key={track.id}
          draggable
          onDragStart={() => handleDragStart(track.id)}
          onDragOver={(e) => handleDragOver(e, track.id)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          style={{ ...s.trackRow, opacity: track.id === draggingId ? 0.35 : 1 }}
        >
          <span style={s.dragHandle} title="Drag to reorder">⠿</span>
          <span style={{ fontSize: '0.72rem', flexShrink: 0, color: '#666' }}>
            {track.type === 'youtube' ? '▶' : '🎵'}
          </span>
          <span style={s.trackName}>{track.name}</span>
          <button style={{ ...s.iconBtn, color: '#444', fontSize: '0.7rem' }} onClick={() => onDelete(track.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── AddTrackForm ──────────────────────────────────────────────────────────────

function AddTrackForm({ playlistId, onSuccess, onCancel }: {
  playlistId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'youtube'>('youtube');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addTrack = useMutation({
    mutationFn: async (data: { name: string; type: 'file' | 'youtube'; url: string }) => {
      const res = await fetch('/api/playlists/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, ...data, sortOrder: 0 }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess,
  });

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const errors: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append('file', files[i]);
        const res = await fetch('/api/playlists/upload', { method: 'POST', body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
          errors.push(`${files[i].name}: ${body.error ?? 'Upload failed'}`);
          continue;
        }
        const { url: fileUrl, name: fileName } = await res.json() as { url: string; name: string };
        await fetch('/api/playlists/tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistId, name: fileName, type: 'file', url: fileUrl, sortOrder: 0 }),
        });
      }
      if (errors.length > 0) setUploadError(errors.join('\n'));
      else onSuccess();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={s.addTrackPanel}>
      <select style={s.input} value={type} onChange={(e) => setType(e.target.value as 'file' | 'youtube')}>
        <option value="youtube">YouTube</option>
        <option value="file">Upload File</option>
      </select>
      {type === 'youtube' ? (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && url.trim()) addTrack.mutate({ name: name.trim(), type, url: url.trim() }); }}>
          <input style={{ ...s.input, marginTop: 6 }} placeholder="Track name" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={{ ...s.input, marginTop: 6 }} placeholder="YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button style={s.btnPrimary} type="submit" disabled={addTrack.isPending || !name.trim() || !url.trim()}>Add</button>
            <button style={s.btnGhost} type="button" onClick={onCancel}>Cancel</button>
          </div>
          {addTrack.isError && <div style={s.error}>{String(addTrack.error)}</div>}
        </form>
      ) : (
        <>
          <input ref={fileRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={(e) => handleFileUpload(e.target.files)} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button style={s.btnPrimary} type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : 'Choose Audio Files'}
            </button>
            <button style={s.btnGhost} type="button" onClick={onCancel}>Cancel</button>
          </div>
          {uploadError && <div style={s.error}>{uploadError}</div>}
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  drawer: {
    position: 'fixed',
    right: 0, top: 0, bottom: 48,
    width: 340,
    background: '#0c0c1e',
    borderLeft: '1px solid #2a2a4a',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    boxShadow: '-6px 0 24px rgba(0,0,0,0.5)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a4a',
    background: '#16213e',
    flexShrink: 0,
  },
  drawerTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#c9a84c',
    letterSpacing: '0.05em',
  },
  newBtn: {
    background: 'transparent',
    border: '1px solid #c9a84c',
    color: '#c9a84c',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '4px 10px',
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid #3a3a5a',
    color: '#666',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '4px 8px',
  },
  newForm: {
    padding: '12px 16px',
    borderBottom: '1px solid #1a1a3a',
    background: '#0f0f1f',
    flexShrink: 0,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
  },
  card: {
    background: '#16213e',
    border: '1px solid #2a2a4a',
    borderLeft: '3px solid #2a2a4a',
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardPlaying: {
    borderLeftColor: '#c9a84c',
    background: '#1a2040',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
  },
  playingPip: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#c9a84c',
    flexShrink: 0,
    boxShadow: '0 0 6px #c9a84c',
  },
  cardInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  plName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#e0e0e0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackCount: {
    fontSize: '0.7rem',
    color: '#555',
  },
  cardActions: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '4px 6px',
    borderRadius: 3,
    lineHeight: 1,
    color: '#666',
  },
  modeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '4px 5px',
    borderRadius: 3,
    lineHeight: 1,
  },
  trackSection: {
    padding: '0 10px 10px',
    borderTop: '1px solid #1a1a3a',
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
    background: '#0f0f1f',
    borderRadius: 4,
    marginBottom: 3,
    cursor: 'default',
    transition: 'opacity 0.1s',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#333',
    fontSize: '1rem',
    userSelect: 'none',
    lineHeight: 1,
    flexShrink: 0,
  },
  trackName: {
    flex: 1,
    fontSize: '0.8rem',
    color: '#ccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  addTrackBtn: {
    background: 'none',
    border: '1px dashed #3a3a5a',
    color: '#666',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '5px 12px',
    width: '100%',
    marginTop: 6,
    textAlign: 'center',
  },
  addTrackPanel: {
    marginTop: 8,
    padding: '10px',
    background: '#0a0a18',
    borderRadius: 4,
    border: '1px solid #2a2a4a',
  },
  input: {
    background: '#0f0f1f',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '6px 10px',
    fontSize: '0.825rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '6px 14px',
    background: 'transparent',
    color: '#c9a84c',
    border: '1px solid #c9a84c',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  btnGhost: {
    padding: '6px 14px',
    background: 'transparent',
    color: '#666',
    border: '1px solid #3a3a5a',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  error: {
    marginTop: 4,
    color: '#e05252',
    fontSize: '0.72rem',
    whiteSpace: 'pre-line',
  },
  muted: {
    color: '#555',
    fontStyle: 'italic',
    fontSize: '0.8rem',
    margin: '12px 0',
    textAlign: 'center',
  },
};
