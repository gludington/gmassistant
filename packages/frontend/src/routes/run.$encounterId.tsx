import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import type { LiveCombatant } from '@gmassisstant/types';
import { useBroadcastSender, useBroadcastReceiver } from '../hooks/useBroadcast';
import { CONDITIONS, conditionIcon } from '../conditions';
import { Open5eSearch } from '../components/Open5eSearch';
import { GmHeader, dropdownItem, dropdownItemActive } from '../components/GmHeader';
import { StatBlockEditor } from '../components/StatBlockEditor';
import { useAudio } from '../hooks/useAudio';
import { useCurrentAdventure } from '../context/AdventureContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface BaseCombatant {
  id: number;
  name: string;
  maxHp: number;
  initiativeModifier: number;
  type: 'pc' | 'npc' | 'enemy' | 'group' | 'event' | 'lair';
  color: string | null;
  description?: string | null;
  visibleToPlayers?: boolean;
  isAdventurePlayer?: boolean;
  armorClass?: number | null;
  spellDc?: number | null;
  passivePerception?: number | null;
  statBlock?: string | null;
  members?: { id: number; label: string; maxHp: number }[];
}

interface EncounterData {
  id: number;
  adventureId: number;
  name: string;
  description: string | null;
  showHp: boolean;
  showInitiative: boolean;
  playlistId: number | null;
  combatants: BaseCombatant[];
}

interface RunCombatant extends LiveCombatant {
  initiativeModifier: number;
  isAdventurePlayer: boolean;
  visibleToPlayers: boolean;
  description: string | null;
  editingHp: boolean;
  editingInit: boolean;
  armorClass?: number | null;
  spellDc?: number | null;
  passivePerception?: number | null;
  statBlock?: string | null;
  legendaryActionsMax?: number;
  legendaryActionsRemaining?: number;
  legendaryResistancesMax?: number;
  legendaryResistancesRemaining?: number;
  usedRechargeAbilities?: string[];
  autoExpanded?: boolean;
  members?: { id: number; label: string; currentHp: number; maxHp: number; conditions: string[] }[];
}

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/run/$encounterId')({
  component: EncounterRunner,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

function toRunCombatant(c: BaseCombatant): RunCombatant {
  if (c.type === 'group' && c.members && c.members.length > 0) {
    const members = c.members.map((m) => ({ ...m, currentHp: m.maxHp, conditions: [] as string[] }));
    const totalHp = members.reduce((sum, m) => sum + m.maxHp, 0);
    return {
      id: c.id,
      name: c.name,
      currentHp: totalHp,
      maxHp: totalHp,
      initiative: null,
      type: c.type,
      color: c.color,
      conditions: [],
      initiativeModifier: c.initiativeModifier,
      isAdventurePlayer: false,
      visibleToPlayers: c.visibleToPlayers ?? true,
      description: c.description ?? null,
      editingHp: false,
      editingInit: false,
      members,
    };
  }
  const isGmOnly = c.type === 'event' || c.type === 'lair';
  let legendaryActionsMax: number | undefined;
  let legendaryResistancesMax: number | undefined;
  if (c.statBlock) {
    try {
      const sb = JSON.parse(c.statBlock);
      const allActions: { action_type?: string; name?: string }[] = sb.actions ?? [];
      const legendaryActionsArray: unknown[] = sb.legendary_actions ?? [];
      const hasLegendary = allActions.some((a) => a.action_type === 'LEGENDARY_ACTION') || legendaryActionsArray.length > 0;
      if (hasLegendary) legendaryActionsMax = 3;
      const traitSources: { name?: string; desc?: string }[] =
        (sb.traits ?? []).concat(sb.special_abilities ?? []).concat(allActions);
      for (const trait of traitSources) {
        const name: string = trait.name ?? '';
        if (/legendary resistance/i.test(name)) {
          const m = /\((\d+)/i.exec(name);
          legendaryResistancesMax = m ? parseInt(m[1], 10) : 3;
          break;
        }
      }
      if (legendaryResistancesMax == null && typeof sb.legendary_resistance === 'number' && sb.legendary_resistance > 0) {
        legendaryResistancesMax = sb.legendary_resistance;
      }
    } catch {}
  }
  return {
    id: c.id,
    name: c.name,
    currentHp: c.maxHp,
    maxHp: c.maxHp,
    initiative: null,
    type: c.type,
    color: c.color,
    conditions: [],
    initiativeModifier: c.initiativeModifier,
    isAdventurePlayer: c.isAdventurePlayer ?? false,
    visibleToPlayers: c.isAdventurePlayer ? true : (c.visibleToPlayers ?? !isGmOnly),
    description: c.description ?? null,
    editingHp: false,
    editingInit: false,
    armorClass: c.armorClass ?? null,
    spellDc: c.spellDc ?? null,
    passivePerception: c.passivePerception ?? null,
    statBlock: c.statBlock ?? null,
    legendaryActionsMax,
    legendaryActionsRemaining: legendaryActionsMax,
    legendaryResistancesMax,
    legendaryResistancesRemaining: legendaryResistancesMax,
    usedRechargeAbilities: [],
  };
}

function applyBloodied(c: RunCombatant): RunCombatant {
  if (c.type === 'event' || c.type === 'lair') return c;
  if (c.type === 'group' && c.members) {
    const members = c.members.map((m) => {
      if (m.maxHp === 0) return m;
      const shouldBeBloodied = m.currentHp < m.maxHp / 2;
      const hasBloodied = m.conditions.includes('Bloodied');
      if (shouldBeBloodied && !hasBloodied) return { ...m, conditions: [...m.conditions, 'Bloodied'] };
      if (!shouldBeBloodied && hasBloodied) return { ...m, conditions: m.conditions.filter((x) => x !== 'Bloodied') };
      return m;
    });
    return members.some((m, i) => m !== c.members![i]) ? { ...c, members } : c;
  }
  if (c.maxHp === 0) return c;
  const shouldBeBloodied = c.currentHp < c.maxHp / 2;
  const hasBloodied = c.conditions.includes('Bloodied');
  if (shouldBeBloodied && !hasBloodied) return { ...c, conditions: [...c.conditions, 'Bloodied'] };
  if (!shouldBeBloodied && hasBloodied) return { ...c, conditions: c.conditions.filter((x) => x !== 'Bloodied') };
  return c;
}

function sortCombatants(list: RunCombatant[]): RunCombatant[] {
  return [...list].sort((a, b) => {
    if (a.initiative === null && b.initiative === null) return a.name.localeCompare(b.name);
    if (a.initiative === null) return 1;
    if (b.initiative === null) return -1;
    return b.initiative - a.initiative;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

function EncounterRunner() {
  const { encounterId } = Route.useParams();
  const navigate = useNavigate();
  const send = useBroadcastSender();
  const { playPlaylist } = useAudio();
  const { setAdventureId } = useCurrentAdventure();
  const [combatants, setCombatants] = useState<RunCombatant[]>([]);
  const [showOnPlayer, setShowOnPlayer] = useState(() => {
    try {
      const raw = localStorage.getItem('gma:initiative');
      if (raw) return !!(JSON.parse(raw).visible);
    } catch {}
    return false;
  });
  const [showHp, setShowHp] = useState(false);
  const [showInitiative, setShowInitiative] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeCombatantId, setActiveCombatantId] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [statBlockCombatant, setStatBlockCombatant] = useState<RunCombatant | null>(null);
  const tempIdRef = useRef(-100000);
  const runKey = `gma:run:${encounterId}`;

  useEffect(() => { send({ type: 'CLEAR_IMAGE' }); }, []);

  const { data: encounter, isLoading, isFetching } = useQuery<EncounterData>({
    queryKey: ['encounter', encounterId],
    queryFn: async () => {
      const res = await fetch(`/api/encounters/${encounterId}`);
      if (!res.ok) throw new Error('Failed to load encounter');
      return res.json();
    },
    refetchOnMount: 'always',
  });

  const { data: otherEncounters = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['adventure-encounters', encounter?.adventureId],
    queryFn: async () => {
      const res = await fetch(`/api/adventures/${encounter!.adventureId}`);
      const data = await res.json();
      return (data.encounters as { id: number; name: string }[]).filter((e) => e.id !== Number(encounterId));
    },
    enabled: !!encounter,
  });

  useEffect(() => {
    if (encounter) {
      setAdventureId(encounter.adventureId);
      return () => setAdventureId(null);
    }
  }, [encounter?.adventureId]);

  useEffect(() => {
    if (encounter && !initialized && !isFetching) {
      let newCombatants: RunCombatant[];
      let initRound = 1;
      let initActiveId: number | null = null;
      let initShowOnPlayer = showOnPlayer;
      let isResume = false;

      const saved = localStorage.getItem(runKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const savedList = parsed.combatants as RunCombatant[];
          // Include ALL saved combatants (players have negative ids too).
          const savedById = new Map(savedList.map((c) => [c.id, c]));
          const apiIds = new Set(encounter.combatants.map((c) => c.id));

          // Drop combatants removed from the encounter.
          // Temp combatants added mid-combat have large negative ids (≤ -100000) and
          // no isAdventurePlayer flag — keep those unconditionally.
          const merged = savedList
            .filter((c) => {
              if (c.id > 0 || c.isAdventurePlayer) return apiIds.has(c.id);
              return true; // temp combatant added during this combat
            })
            .map((c) => {
              const api = encounter.combatants.find((a) => a.id === c.id);
              if (!api) return c; // temp combatant — no API entry
              return {
                ...c,
                name: api.name,
                maxHp: api.maxHp,
                initiativeModifier: api.initiativeModifier,
                color: api.color,
                armorClass: api.armorClass ?? null,
                spellDc: api.spellDc ?? null,
                passivePerception: api.passivePerception ?? null,
                statBlock: api.statBlock ?? null,
                description: api.description ?? null,
                visibleToPlayers: api.isAdventurePlayer ? true : (api.visibleToPlayers ?? c.visibleToPlayers),
              };
            });

          // Add combatants newly added to the encounter since the run started.
          for (const api of encounter.combatants) {
            if (!savedById.has(api.id)) merged.push(toRunCombatant(api));
          }

          newCombatants = merged;
          initRound = parsed.round ?? 1;
          initActiveId = parsed.activeCombatantId ?? null;
          initShowOnPlayer = parsed.showOnPlayer ?? showOnPlayer;
          isResume = true;
        } catch {
          newCombatants = encounter.combatants.map(toRunCombatant);
        }
      } else {
        newCombatants = encounter.combatants.map(toRunCombatant);
      }

      setCombatants(newCombatants);
      setRound(initRound);
      setActiveCombatantId(initActiveId);
      if (initShowOnPlayer !== showOnPlayer) setShowOnPlayer(initShowOnPlayer);
      setShowHp(encounter.showHp);
      setShowInitiative(encounter.showInitiative);
      setInitialized(true);
      broadcast(newCombatants, initShowOnPlayer, encounter.showHp, encounter.showInitiative, initActiveId, initRound);

      if (!isResume && encounter.playlistId) {
        fetch(`/api/playlists?adventureId=${encounter.adventureId}`)
          .then((r) => r.json())
          .then((pls: { id: number; name: string; sortOrder: number; adventureId: number; playMode: 'sequential' | 'shuffle'; loop: boolean; tracks: { id: number; playlistId: number; name: string; type: 'file' | 'youtube'; url: string; sortOrder: number }[] }[]) => {
            const pl = pls.find((p) => p.id === encounter.playlistId);
            if (pl && pl.tracks.length > 0) playPlaylist(pl);
          })
          .catch(() => {});
      }
    }
  }, [encounter, initialized, isFetching]);

  // Persist live encounter state synchronously after each render (useLayoutEffect
  // runs before paint, ensuring removeItem in endEncounter always wins the race
  // against a deferred useEffect that would re-write the key).
  useLayoutEffect(() => {
    if (!initialized) return;
    localStorage.setItem(runKey, JSON.stringify({
      combatants: combatants.map((c) => ({ ...c, editingHp: false, editingInit: false })),
      round,
      activeCombatantId,
      showOnPlayer,
    }));
  }, [combatants, round, activeCombatantId, showOnPlayer, initialized]);

  // Broadcast next state directly — called from every event handler so the
  // send happens synchronously with the new values, not via a useEffect.
  function broadcast(nextCombatants: RunCombatant[], nextVisible: boolean, nextShowHp = showHp, nextShowInitiative = showInitiative, nextActiveId: number | null = activeCombatantId, nextRound = round) {
    const live = sortCombatants(nextCombatants);
    const playerVisible = live.filter((c) => c.isAdventurePlayer || c.visibleToPlayers !== false);
    localStorage.setItem('gma:initiative', JSON.stringify({ combatants: playerVisible, visible: nextVisible, showHp: nextShowHp, showInitiative: nextShowInitiative, activeCombatantId: nextActiveId, round: nextRound }));
    send({ type: 'TOGGLE_INITIATIVE', payload: { visible: nextVisible } });
    send({ type: 'SET_SHOW_HP', payload: { showHp: nextShowHp } });
    send({ type: 'SET_SHOW_INITIATIVE', payload: { showInitiative: nextShowInitiative } });
    if (nextVisible) {
      send({ type: 'UPDATE_INITIATIVE', payload: { combatants: playerVisible, activeCombatantId: nextActiveId, round: nextRound } });
    }
  }

  async function toggleShowHp() {
    if (!encounter) return;
    const next = !showHp;
    setShowHp(next);
    broadcast(combatants, showOnPlayer, next);
    await fetch(`/api/adventures/${encounter.adventureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showHp: next }),
    });
  }

  async function toggleShowInitiative() {
    if (!encounter) return;
    const next = !showInitiative;
    setShowInitiative(next);
    broadcast(combatants, showOnPlayer, showHp, next);
    await fetch(`/api/adventures/${encounter.adventureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showInitiative: next }),
    });
  }

  function togglePlayer() {
    const next = !showOnPlayer;
    setShowOnPlayer(next);
    broadcast(combatants, next);
  }

  function applyAndBroadcast(next: RunCombatant[]) {
    const withB = next.map(applyBloodied);
    setCombatants(withB);
    if (showOnPlayer) broadcast(withB, true);
  }

  function rollInitiative(id: number) {
    const c = combatants.find((x) => x.id === id);
    if (!c) return;
    applyAndBroadcast(
      combatants.map((x) => x.id === id ? { ...x, initiative: d20() + x.initiativeModifier, editingInit: false } : x)
    );
  }

  function rollAll() {
    applyAndBroadcast(
      combatants.map((c) => c.isAdventurePlayer ? c : { ...c, initiative: d20() + c.initiativeModifier, editingInit: false })
    );
  }

  function adjustHp(id: number, delta: number) {
    const c = combatants.find((x) => x.id === id);
    if (!c) return;
    if (c.type === 'group') return; // groups use per-member HP
    applyAndBroadcast(
      combatants.map((x) => x.id === id ? { ...x, currentHp: Math.max(0, Math.min(x.maxHp, x.currentHp + delta)) } : x)
    );
  }

  function resetEncounter() {
    if (!encounter) return;
    localStorage.removeItem(runKey);
    const next = encounter.combatants.map(toRunCombatant);
    setCombatants(next);
    setRound(1);
    setActiveCombatantId(null);
    broadcast(next, showOnPlayer, showHp, showInitiative, null, 1);
  }

  function endEncounter() {
    if (!encounter) return;
    localStorage.removeItem(runKey);
    send({ type: 'TOGGLE_INITIATIVE', payload: { visible: false } });
    try {
      const raw = localStorage.getItem('gma:initiative');
      if (raw) localStorage.setItem('gma:initiative', JSON.stringify({ ...JSON.parse(raw), visible: false }));
    } catch {}
    navigate({ to: '/adventures/$adventureId', params: { adventureId: String(encounter.adventureId) } });
  }

  function navigateActive(direction: 1 | -1) {
    const sorted = sortCombatants(combatants);
    if (sorted.length === 0) return;
    const currentIdx = activeCombatantId !== null ? sorted.findIndex((c) => c.id === activeCombatantId) : -1;
    let nextIdx: number;
    let roundDelta = 0;
    if (currentIdx === -1) {
      nextIdx = direction === 1 ? 0 : sorted.length - 1;
    } else {
      nextIdx = (currentIdx + direction + sorted.length) % sorted.length;
      if (direction === 1 && currentIdx === sorted.length - 1) roundDelta = 1;
      if (direction === -1 && currentIdx === 0) roundDelta = -1;
    }
    const newRound = Math.max(1, round + roundDelta);
    if (roundDelta !== 0) setRound(newRound);
    const nextId = sorted[nextIdx].id;
    const prevId = currentIdx !== -1 ? sorted[currentIdx].id : null;
    setActiveCombatantId(nextId);
    const nextCombatants = combatants.map((c) => {
      if (prevId !== null && c.id === prevId && c.type === 'group' && c.autoExpanded) {
        return { ...c, membersExpanded: false, autoExpanded: false };
      }
      if (c.id === nextId) {
        const withLegendary = c.legendaryActionsMax != null ? { ...c, legendaryActionsRemaining: c.legendaryActionsMax } : c;
        if (c.type === 'group') {
          const wasAlreadyOpen = c.membersExpanded;
          return { ...withLegendary, membersExpanded: true, autoExpanded: !wasAlreadyOpen };
        }
        return withLegendary;
      }
      return c;
    });
    if (nextCombatants !== combatants) setCombatants(nextCombatants);
    broadcast(nextCombatants, showOnPlayer, showHp, showInitiative, nextId, newRound);
  }

  function activateCombatant(id: number) {
    const nextId = activeCombatantId === id ? null : id;
    setActiveCombatantId(nextId);
    const nextCombatants = combatants.map((c) => {
      if (c.id === activeCombatantId && c.type === 'group' && c.autoExpanded) {
        return { ...c, membersExpanded: false, autoExpanded: false };
      }
      if (nextId !== null && c.id === nextId && c.type === 'group') {
        const wasAlreadyOpen = c.membersExpanded;
        return { ...c, membersExpanded: true, autoExpanded: !wasAlreadyOpen };
      }
      return c;
    });
    if (nextCombatants !== combatants) setCombatants(nextCombatants);
    broadcast(nextCombatants, showOnPlayer, showHp, showInitiative, nextId);
  }

  // Used by CombatantRow for inline HP/init edits.
  // edit-mode toggles (editingHp/editingInit) don't broadcast — only real value changes do.
  function update(id: number, patch: Partial<RunCombatant>) {
    const onlyEditToggle = Object.keys(patch).every((k) => k === 'editingHp' || k === 'editingInit');
    const next = combatants.map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, ...patch };
      if (updated.members) {
        updated.currentHp = updated.members.reduce((sum, m) => sum + m.currentHp, 0);
        updated.maxHp = updated.members.reduce((sum, m) => sum + m.maxHp, 0);
      }
      return onlyEditToggle ? updated : applyBloodied(updated);
    });
    setCombatants(next);
    if (!onlyEditToggle && showOnPlayer) broadcast(next, true);
  }

  function addCombatant(values: { name: string; maxHp: number; initiativeModifier: number; type: RunCombatant['type']; color: string; description: string | null; visibleToPlayers: boolean; initiative: number | null; statBlock?: string; members?: { label: string; maxHp: number }[] }) {
    let newCombatant: RunCombatant;
    if (values.type === 'group' && values.members && values.members.length > 0) {
      const members = values.members.map((m) => ({
        id: tempIdRef.current--,
        label: m.label,
        currentHp: m.maxHp,
        maxHp: m.maxHp,
        conditions: [] as string[],
      }));
      const totalHp = members.reduce((sum, m) => sum + m.maxHp, 0);
      newCombatant = {
        id: tempIdRef.current--,
        name: values.name,
        currentHp: totalHp,
        maxHp: totalHp,
        initiative: values.initiative,
        type: values.type,
        color: values.color,
        conditions: [],
        initiativeModifier: values.initiativeModifier,
        isAdventurePlayer: false,
        visibleToPlayers: values.visibleToPlayers,
        description: values.description,
        editingHp: false,
        editingInit: false,
        members,
      };
    } else {
      newCombatant = {
        id: tempIdRef.current--,
        name: values.name,
        currentHp: values.maxHp,
        maxHp: values.maxHp,
        initiative: values.initiative,
        type: values.type,
        color: values.color,
        conditions: [],
        initiativeModifier: values.initiativeModifier,
        isAdventurePlayer: false,
        visibleToPlayers: values.visibleToPlayers,
        description: values.description,
        editingHp: false,
        editingInit: false,
        statBlock: values.statBlock ?? null,
      };
    }
    const next = [...combatants, newCombatant];
    setCombatants(next);
    setShowAddForm(false);
    if (showOnPlayer) broadcast(next, true);
  }

  async function copyCombatant(c: RunCombatant, targetEncounterId: number | null) {
    const base = {
      name: c.name,
      maxHp: c.maxHp,
      initiativeModifier: c.initiativeModifier,
      type: c.type,
      color: c.color ?? '#888888',
      description: c.description,
      visibleToPlayers: c.visibleToPlayers,
      statBlock: c.statBlock ?? undefined,
      members: c.members?.map((m) => ({ label: m.label, maxHp: m.maxHp })),
    };
    if (targetEncounterId === null) {
      addCombatant({ ...base, initiative: null });
    } else {
      await fetch('/api/encounters/combatants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, encounterId: targetEncounterId }),
      });
    }
  }

  async function updateCombatantBase(id: number, values: { name: string; maxHp: number; initiativeModifier: number; type: RunCombatant['type']; color: string; description?: string | null; statBlock?: string }) {
    const c = combatants.find((x) => x.id === id);
    await fetch(`/api/encounters/combatants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, description: values.description ?? c?.description ?? null, visibleToPlayers: c?.visibleToPlayers ?? true }),
    });
    const next = combatants.map((x) =>
      x.id === id
        ? { ...x, ...values, currentHp: Math.min(x.currentHp, values.maxHp) }
        : x
    );
    setCombatants(next);
    if (showOnPlayer) broadcast(next, true);
  }

  async function toggleVisibility(id: number) {
    const c = combatants.find((x) => x.id === id);
    if (!c) return;
    const next = combatants.map((x) => x.id === id ? { ...x, visibleToPlayers: !x.visibleToPlayers } : x);
    setCombatants(next);
    if (showOnPlayer) broadcast(next, true);
    if (id > 0) {
      await fetch(`/api/encounters/combatants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier, type: c.type, color: c.color ?? '#888888', description: c.description, visibleToPlayers: !c.visibleToPlayers }),
      });
    }
  }

  useBroadcastReceiver((msg) => {
    if (msg.type === 'COMBATANT_UPDATED') {
      if (msg.payload.encounterId !== encounter?.id) return;
      const { combatant: u } = msg.payload;
      setCombatants((prev) => {
        const next = prev.map((c) => {
          if (c.id !== u.id) return c;
          if (u.type === 'group' && u.members && u.members.length > 0) {
            const mergedMembers = u.members.map((m) => {
              const existing = c.members?.find((x) => x.id === m.id);
              return { id: m.id, label: m.label, maxHp: m.maxHp, currentHp: existing ? Math.min(existing.currentHp, m.maxHp) : m.maxHp, conditions: existing?.conditions ?? [] };
            });
            const totalHp = mergedMembers.reduce((sum, m) => sum + m.maxHp, 0);
            const currentHp = mergedMembers.reduce((sum, m) => sum + m.currentHp, 0);
            return { ...c, name: u.name, maxHp: totalHp, currentHp, initiativeModifier: u.initiativeModifier, type: u.type, color: u.color, members: mergedMembers };
          }
          return { ...c, name: u.name, maxHp: u.maxHp, initiativeModifier: u.initiativeModifier, type: u.type, color: u.color, currentHp: Math.min(c.currentHp, u.maxHp) };
        });
        if (showOnPlayer) broadcast(next, true);
        return next;
      });
    } else if (msg.type === 'COMBATANT_ADDED') {
      if (msg.payload.encounterId !== encounter?.id) return;
      const newC = toRunCombatant(msg.payload.combatant);
      setCombatants((prev) => {
        const next = applyBloodied(newC) === newC ? [...prev, newC] : [...prev, applyBloodied(newC)];
        if (showOnPlayer) broadcast(next, true);
        return next;
      });
    } else if (msg.type === 'COMBATANT_REMOVED') {
      if (msg.payload.encounterId !== encounter?.id) return;
      setCombatants((prev) => {
        const next = prev.filter((c) => c.id !== msg.payload.combatantId);
        if (showOnPlayer) broadcast(next, true);
        return next;
      });
    }
  });

  if (isLoading) return <div style={s.page}><p style={s.muted}>Loading...</p></div>;
  if (!encounter) return <div style={s.page}><p style={s.muted}>Encounter not found.</p></div>;

  const sorted = sortCombatants(combatants);

  return (
    <div style={s.page}>
      <GmHeader
        playerMenuItems={
          <>
            <button style={showOnPlayer ? dropdownItemActive : dropdownItem} onClick={togglePlayer}>
              {showOnPlayer ? '✔ Tracker visible' : '✗ Tracker hidden'}
            </button>
            <button style={showInitiative ? dropdownItemActive : dropdownItem} onClick={toggleShowInitiative}>
              {showInitiative ? '✔ Initiative visible' : '✗ Initiative hidden'}
            </button>
            <button style={showHp ? dropdownItemActive : dropdownItem} onClick={toggleShowHp}>
              {showHp ? '✔ HP visible' : '✗ HP hidden'}
            </button>
          </>
        }
      >
        <Link
          to="/adventures/$adventureId"
          params={{ adventureId: String(encounter.adventureId) }}
          style={s.back}
        >
          ← Back
        </Link>
        <h1 style={s.title}>{encounter.name}</h1>
        <div style={s.activeNav}>
          <span style={s.roundLabel}>Round {round}</span>
          <button style={s.navBtn} onClick={() => navigateActive(-1)} title="Previous combatant">◀</button>
          <span style={s.activeName}>
            {activeCombatantId !== null
              ? (sorted.find((c) => c.id === activeCombatantId)?.name ?? '—')
              : <span style={{ color: '#444' }}>— no active —</span>}
          </span>
          <button style={s.navBtn} onClick={() => navigateActive(1)} title="Next combatant">▶</button>
        </div>
        <div style={s.headerActions}>
          <button style={s.btnHdr} onClick={rollAll} title="Roll All Initiative">Init</button>
          <button style={s.btnHdr} onClick={resetEncounter} title="Reset Encounter">Reset</button>
          <button style={s.btnHdrDanger} onClick={endEncounter} title="End Encounter">End</button>
          <button style={showAddForm ? s.btnHdrActive : s.btnHdr} onClick={() => setShowAddForm((v) => !v)} title={showAddForm ? 'Cancel' : 'Add Combatant'}>
            {showAddForm ? '✕' : '+'}
          </button>
        </div>
      </GmHeader>

      <main style={s.main}>
        {showAddForm && (
          <AddCombatantForm
            onSubmit={addCombatant}
            onCancel={() => setShowAddForm(false)}
          />
        )}
        {sorted.length === 0 && (
          <p style={s.muted}>No combatants in this encounter.</p>
        )}
        <div style={s.table}>
          {sorted.map((c) => (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActive={c.id === activeCombatantId}
              onRollInit={() => rollInitiative(c.id)}
              onAdjustHp={(delta) => adjustHp(c.id, delta)}
              onUpdate={(patch) => update(c.id, patch)}
              onUpdateBase={(values) => updateCombatantBase(c.id, values)}
              onToggleVisible={() => toggleVisibility(c.id)}
              onSetActive={() => activateCombatant(c.id)}
              onShowStatBlock={c.statBlock ? () => setStatBlockCombatant(c) : undefined}
              onCopy={(targetEncounterId) => copyCombatant(c, targetEncounterId)}
              otherEncounters={otherEncounters}
            />
          ))}
        </div>
      </main>
      {statBlockCombatant && (
        <StatBlockPanel
          combatant={statBlockCombatant}
          onClose={() => setStatBlockCombatant(null)}
          onEditStatBlock={(json) => {
            update(statBlockCombatant.id, { statBlock: json });
            setStatBlockCombatant((prev) => prev ? { ...prev, statBlock: json } : null);
          }}
        />
      )}
    </div>
  );
}

// ── CombatantRow ──────────────────────────────────────────────────────────────

function CombatantRow({
  combatant: c,
  isActive,
  onRollInit,
  onAdjustHp,
  onUpdate,
  onUpdateBase,
  onToggleVisible,
  onSetActive,
  onShowStatBlock,
  onCopy,
  otherEncounters,
}: {
  combatant: RunCombatant;
  isActive: boolean;
  onRollInit: () => void;
  onAdjustHp: (delta: number) => void;
  onUpdate: (patch: Partial<RunCombatant>) => void;
  onUpdateBase: (values: { name: string; maxHp: number; initiativeModifier: number; type: RunCombatant['type']; color: string; statBlock?: string }) => void;
  onToggleVisible: () => void;
  onSetActive: () => void;
  onShowStatBlock?: () => void;
  onCopy: (targetEncounterId: number | null) => void;
  otherEncounters: { id: number; name: string }[];
}) {
  const [editingBase, setEditingBase] = useState(false);
  const [showCondPicker, setShowCondPicker] = useState(false);
  const [memberCondPickerId, setMemberCondPickerId] = useState<number | null>(null);
  const [hpAdjustVal, setHpAdjustVal] = useState('');
  const [memberAdjustVals, setMemberAdjustVals] = useState<Record<number, string>>({});
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const isGroup = c.type === 'group';
  const isGmOnly = c.type === 'event' || c.type === 'lair';

  const rechargeActions = useMemo(() => {
    if (!c.statBlock) return [];
    try {
      const sb = JSON.parse(c.statBlock);
      const allActions: { name?: string; action_type?: string; usage_limits?: { type?: string; param?: number } }[] = sb.actions ?? [];
      return allActions
        .filter((a) => a.usage_limits?.type === 'RECHARGE_ON_ROLL' && a.usage_limits.param != null)
        .map((a) => ({ name: a.name ?? '', min: a.usage_limits!.param! }));
    } catch { return []; }
  }, [c.statBlock]);

  function toggleCondition(name: string, hasLevel?: true) {
    const existing = c.conditions.find((x) => x === name || x.startsWith(name + ' '));
    const next = existing
      ? c.conditions.filter((x) => x !== existing)
      : [...c.conditions, hasLevel ? `${name} 1` : name];
    onUpdate({ conditions: next });
  }

  function adjustExhaustion(delta: number) {
    const existing = c.conditions.find((x) => x.startsWith('Exhaustion '));
    if (!existing) return;
    const level = parseInt(existing.split(' ')[1] ?? '1', 10);
    const next = Math.max(1, Math.min(6, level + delta));
    onUpdate({ conditions: c.conditions.map((x) => x.startsWith('Exhaustion ') ? `Exhaustion ${next}` : x) });
  }

  function toggleMemberCondition(memberId: number, name: string, hasLevel?: true) {
    if (!c.members) return;
    const updatedMembers = c.members.map((m) => {
      if (m.id !== memberId) return m;
      const existing = m.conditions.find((x) => x === name || x.startsWith(name + ' '));
      const conditions = existing
        ? m.conditions.filter((x) => x !== existing)
        : [...m.conditions, hasLevel ? `${name} 1` : name];
      return { ...m, conditions };
    });
    onUpdate({ members: updatedMembers });
  }

  function adjustMemberExhaustion(memberId: number, delta: number) {
    if (!c.members) return;
    const updatedMembers = c.members.map((m) => {
      if (m.id !== memberId) return m;
      const existing = m.conditions.find((x) => x.startsWith('Exhaustion '));
      if (!existing) return m;
      const level = parseInt(existing.split(' ')[1] ?? '1', 10);
      const next = Math.max(1, Math.min(6, level + delta));
      return { ...m, conditions: m.conditions.map((x) => x.startsWith('Exhaustion ') ? `Exhaustion ${next}` : x) };
    });
    onUpdate({ members: updatedMembers });
  }
  const dead = isGroup && c.members ? c.members.every((m) => m.currentHp === 0) : c.currentHp === 0;
  const hpPct = !isGroup && c.maxHp > 0 ? (c.currentHp / c.maxHp) * 100 : 0;

  function adjustMemberHp(memberId: number, delta: number) {
    if (!c.members) return;
    const updatedMembers = c.members.map((m) =>
      m.id === memberId ? { ...m, currentHp: Math.max(0, Math.min(m.maxHp, m.currentHp + delta)) } : m
    );
    onUpdate({ members: updatedMembers });
  }

  function setMemberHp(memberId: number, val: number) {
    if (!c.members) return;
    const updatedMembers = c.members.map((m) =>
      m.id === memberId ? { ...m, currentHp: Math.max(0, Math.min(m.maxHp, val)) } : m
    );
    onUpdate({ members: updatedMembers });
  }

  return (
    <div style={s.rowWrapper}>
    <div style={{
      ...s.row,
      opacity: dead ? 0.45 : 1,
      borderLeftColor: c.color ?? '#444',
      borderStyle: c.visibleToPlayers ? 'solid' : 'dashed',
      ...(isActive ? { background: '#1e2d1e', boxShadow: `0 0 0 1px ${c.color ?? '#c9a84c'}66, inset 0 0 20px rgba(0,0,0,0.4)` } : {}),
    }}>

      {/* Initiative */}
      <div style={s.initCell}>
        {c.editingInit ? (
          <input
            style={s.initInput}
            type="number"
            autoFocus
            defaultValue={c.initiative ?? ''}
            onBlur={(e) => onUpdate({ initiative: e.target.value === '' ? null : Number(e.target.value), editingInit: false })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') onUpdate({ editingInit: false });
            }}
          />
        ) : (
          <span
            style={c.initiative !== null ? s.initValue : s.initEmpty}
            onClick={() => onUpdate({ editingInit: true })}
            title="Click to edit"
          >
            {c.initiative ?? '—'}
          </span>
        )}
        {!c.isAdventurePlayer && (
          <button style={s.rollBtn} onClick={onRollInit} title={`Roll d20 + ${c.initiativeModifier >= 0 ? '+' : ''}${c.initiativeModifier}`}>
            🎲
          </button>
        )}
      </div>

      {/* Name + type */}
      <div style={s.nameCell}>
        <button
          style={{ ...s.editBtn, color: isActive ? '#c9a84c' : '#444', fontSize: '1rem' }}
          onClick={onSetActive}
          title={isActive ? 'Active combatant (click to deactivate)' : 'Set as active combatant'}
        >{isActive ? '●' : '○'}</button>
        <span style={dead ? s.deadName : s.name}>{c.name}</span>
        <span style={{ ...s.typeBadge, ...typeStyle(c.type) }}>{c.type === 'lair' ? 'lair action' : c.type}</span>
        {isGroup && c.members && c.members.length > 0 && (
          <button
            style={{ ...s.editBtn, fontSize: '1.25rem', color: c.membersExpanded ? '#c9a84c' : '#666' }}
            onClick={() => onUpdate({ membersExpanded: !c.membersExpanded })}
            title={c.membersExpanded ? 'Hide members on player screen' : 'Show members on player screen'}
          >{c.membersExpanded ? '▾' : '▸'}</button>
        )}
        {c.isAdventurePlayer && (
          <>
            {c.armorClass != null && <span style={s.pcStat} title="Armor Class">AC {c.armorClass}</span>}
            {c.spellDc != null && <span style={s.pcStat} title="Spell Save DC">DC {c.spellDc}</span>}
            {c.passivePerception != null && <span style={s.pcStat} title="Passive Perception">PP {c.passivePerception}</span>}
          </>
        )}
        {!isGroup && c.conditions.map((cond) => (
          <span key={cond} style={s.condBadge} title={cond} onClick={() => {
            const base = cond.replace(/\s+\d+$/, '');
            onUpdate({ conditions: c.conditions.filter((x) => x !== cond && !x.startsWith(base + ' ')) });
          }}>{conditionIcon(cond)}</span>
        ))}
        {!isGroup && (
          <button
            style={{ ...s.editBtn, color: showCondPicker ? '#c9a84c' : '#555', fontSize: '0.85rem' }}
            onClick={() => setShowCondPicker((v) => !v)}
            title="Add/remove conditions"
          >🩹</button>
        )}
        {!c.isAdventurePlayer && (
          <button
            style={{ ...s.editBtn, color: c.visibleToPlayers ? '#4caf50' : '#555', fontSize: '0.9rem' }}
            onClick={onToggleVisible}
            title={c.visibleToPlayers ? 'Visible to players (click to hide)' : 'Hidden from players (click to show)'}
          >👁</button>
        )}
        {!c.isAdventurePlayer && (
          <button style={s.editBtn} onClick={() => setEditingBase((v) => !v)} title="Edit">✎</button>
        )}
        {onShowStatBlock && (
          <button style={s.editBtn} onClick={onShowStatBlock} title="View stat block">📖</button>
        )}
        {!c.isAdventurePlayer && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button style={s.editBtn} title="Copy combatant" onClick={() => setShowCopyMenu((v) => !v)}>⧉</button>
            {showCopyMenu && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1a1a2e', border: '1px solid #333', borderRadius: 6, minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', padding: '4px 0' }}
                onMouseLeave={() => setShowCopyMenu(false)}
              >
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', color: '#e0e0e0', cursor: 'pointer', fontSize: '0.82rem' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  onClick={() => { onCopy(null); setShowCopyMenu(false); }}
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
                        onClick={() => { onCopy(e.id); setShowCopyMenu(false); }}
                        title={`Copy to: ${e.name}`}
                      >↗ {e.name}</button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {(rechargeActions.length > 0 || c.legendaryActionsMax != null || c.legendaryResistancesMax != null) && (
          <div style={{ width: '100%', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {c.legendaryActionsMax != null && (
              <LegendaryWidget
                max={c.legendaryActionsMax}
                remaining={c.legendaryActionsRemaining ?? c.legendaryActionsMax}
                onSpend={() => onUpdate({ legendaryActionsRemaining: Math.max(0, (c.legendaryActionsRemaining ?? c.legendaryActionsMax!) - 1) })}
                onRestore={() => onUpdate({ legendaryActionsRemaining: Math.min(c.legendaryActionsMax!, (c.legendaryActionsRemaining ?? c.legendaryActionsMax!) + 1) })}
                onReset={() => onUpdate({ legendaryActionsRemaining: c.legendaryActionsMax })}
                onSetMax={(n) => onUpdate({ legendaryActionsMax: n, legendaryActionsRemaining: n })}
              />
            )}
            {c.legendaryResistancesMax != null && (
              <ResistanceWidget
                max={c.legendaryResistancesMax}
                remaining={c.legendaryResistancesRemaining ?? c.legendaryResistancesMax}
                onSpend={() => onUpdate({ legendaryResistancesRemaining: Math.max(0, (c.legendaryResistancesRemaining ?? c.legendaryResistancesMax!) - 1) })}
                onRestore={() => onUpdate({ legendaryResistancesRemaining: Math.min(c.legendaryResistancesMax!, (c.legendaryResistancesRemaining ?? c.legendaryResistancesMax!) + 1) })}
                onSetMax={(n) => onUpdate({ legendaryResistancesMax: n, legendaryResistancesRemaining: Math.min(c.legendaryResistancesRemaining ?? n, n) })}
              />
            )}
            {rechargeActions.map((ra) => (
              <RechargeWidget
                key={ra.name}
                name={ra.name}
                min={ra.min}
                used={(c.usedRechargeAbilities ?? []).includes(ra.name)}
                isActive={isActive}
                onToggle={() => {
                  const used = c.usedRechargeAbilities ?? [];
                  onUpdate({ usedRechargeAbilities: used.includes(ra.name) ? used.filter((n) => n !== ra.name) : [...used, ra.name] });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* HP / Description */}
      <div style={s.hpCell}>
        {!isGmOnly && (c.type === 'enemy' || c.type === 'npc' || c.type === 'group') && c.description && (
          <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>{c.description}</div>
        )}
        {isGmOnly ? (
          <span style={{ fontSize: '0.9rem', color: '#aaa', fontStyle: 'italic' }}>
            {c.description || <span style={{ color: '#555' }}>No description</span>}
          </span>
        ) : isGroup && c.members ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {c.members.map((m) => {
              const mDead = m.currentHp === 0;
              const mPct = m.maxHp > 0 ? (m.currentHp / m.maxHp) * 100 : 0;
              const mCondPickerOpen = memberCondPickerId === m.id;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ ...s.memberRow, opacity: mDead ? 0.5 : 1 }}>
                    <MemberLabelDisplay
                      memberId={m.id}
                      label={m.label}
                      onRename={(newLabel) => {
                        if (!c.members) return;
                        onUpdate({ members: c.members.map((x) => x.id === m.id ? { ...x, label: newLabel } : x) });
                      }}
                    />
                    {m.conditions.map((cond) => (
                      <span key={cond} style={s.condBadge} title={cond} onClick={() => {
                        const base = cond.replace(/\s+\d+$/, '');
                        toggleMemberCondition(m.id, base);
                      }}>{conditionIcon(cond)}</span>
                    ))}
                    <button
                      style={{ ...s.editBtn, color: mCondPickerOpen ? '#c9a84c' : '#555', fontSize: '0.8rem' }}
                      onClick={() => setMemberCondPickerId(mCondPickerOpen ? null : m.id)}
                      title="Add/remove conditions"
                    >🩹</button>
                    <div style={{ ...s.hpBarTrack, flex: 1, minWidth: 40 }}>
                      <div style={{ ...s.hpBarFill, width: `${mPct}%`, background: hpColor(mPct) }} />
                    </div>
                    {([-5, -1] as const).map((n) => (
                      <button key={n} style={s.dmgBtnSm} onClick={() => adjustMemberHp(m.id, n)}>{n}</button>
                    ))}
                    <MemberHpDisplay member={m} onSet={(val) => setMemberHp(m.id, val)} />
                    {([1, 5] as const).map((n) => (
                      <button key={n} style={s.healBtnSm} onClick={() => adjustMemberHp(m.id, n)}>+{n}</button>
                    ))}
                    <input
                      style={{ ...s.hpAdjustInput, width: 40, marginLeft: 4, fontSize: '0.7rem' }}
                      type="number"
                      min={1}
                      placeholder="amt"
                      value={memberAdjustVals[m.id] ?? ''}
                      onChange={(e) => setMemberAdjustVals((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        const n = parseInt(memberAdjustVals[m.id] ?? '', 10);
                        if (!n || n <= 0) return;
                        if (e.key === 'Enter') { adjustMemberHp(m.id, -n); setMemberAdjustVals((prev) => ({ ...prev, [m.id]: '' })); }
                        if (e.key === 'h' || e.key === 'H') { adjustMemberHp(m.id, n); setMemberAdjustVals((prev) => ({ ...prev, [m.id]: '' })); }
                      }}
                    />
                    <button
                      style={s.dmgBtnSm}
                      disabled={!memberAdjustVals[m.id] || parseInt(memberAdjustVals[m.id], 10) <= 0}
                      onClick={() => { const n = parseInt(memberAdjustVals[m.id] ?? '', 10); if (n > 0) { adjustMemberHp(m.id, -n); setMemberAdjustVals((prev) => ({ ...prev, [m.id]: '' })); } }}
                    >D</button>
                    <button
                      style={s.healBtnSm}
                      disabled={!memberAdjustVals[m.id] || parseInt(memberAdjustVals[m.id], 10) <= 0}
                      onClick={() => { const n = parseInt(memberAdjustVals[m.id] ?? '', 10); if (n > 0) { adjustMemberHp(m.id, n); setMemberAdjustVals((prev) => ({ ...prev, [m.id]: '' })); } }}
                    >H</button>
                    <button
                      style={{ ...s.editBtn, color: '#e05c5c', fontSize: '0.8rem', marginLeft: 2 }}
                      onClick={() => { if (!c.members) return; const next = c.members.filter((x) => x.id !== m.id); onUpdate({ members: next, currentHp: next.reduce((sum, x) => sum + x.currentHp, 0), maxHp: next.reduce((sum, x) => sum + x.maxHp, 0) }); }}
                      title="Remove from group"
                    >🗑</button>
                  </div>
                  {mCondPickerOpen && (
                    <div style={{ ...s.condPicker, paddingTop: 6 }}>
                      {CONDITIONS.map((cond) => {
                        const active = m.conditions.find((x) => x === cond.name || x.startsWith(cond.name + ' '));
                        const level = active && 'hasLevel' in cond ? parseInt(active.split(' ')[1] ?? '1', 10) : null;
                        return (
                          <div key={cond.name} style={s.condPickerItem}>
                            <button
                              style={{ ...s.condPickerBtn, ...(active ? s.condPickerBtnActive : {}) }}
                              onClick={() => toggleMemberCondition(m.id, cond.name, 'hasLevel' in cond ? cond.hasLevel : undefined)}
                            >
                              <span style={s.condPickerIcon}>{cond.icon}</span>
                              <span style={s.condPickerName}>{cond.name}</span>
                            </button>
                            {active && 'hasLevel' in cond && (
                              <div style={s.condLevelControls}>
                                <button style={s.condLevelBtn} onClick={() => adjustMemberExhaustion(m.id, -1)} disabled={level === 1}>−</button>
                                <span style={s.condLevelVal}>{level}</span>
                                <button style={s.condLevelBtn} onClick={() => adjustMemberExhaustion(m.id, 1)} disabled={level === 6}>+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div style={s.hpBarTrack}>
              <div style={{ ...s.hpBarFill, width: `${hpPct}%`, background: hpColor(hpPct) }} />
            </div>
            <div style={s.hpControls}>
              {([-10, -5, -1] as const).map((n) => (
                <button key={n} style={s.dmgBtn} onClick={() => onAdjustHp(n)}>{n}</button>
              ))}
              {c.editingHp ? (
                <input
                  style={s.hpInput}
                  type="number"
                  autoFocus
                  defaultValue={c.currentHp}
                  min={0}
                  max={c.maxHp}
                  onBlur={(e) => onUpdate({ currentHp: Math.max(0, Math.min(c.maxHp, Number(e.target.value))), editingHp: false })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') onUpdate({ editingHp: false });
                  }}
                />
              ) : (
                <span style={s.hpText} onClick={() => onUpdate({ editingHp: true })} title="Click to edit">
                  {c.currentHp}<span style={s.hpMax}>/{c.maxHp}</span>
                </span>
              )}
              {([1, 5, 10] as const).map((n) => (
                <button key={n} style={s.healBtn} onClick={() => onAdjustHp(n)}>+{n}</button>
              ))}
              <input
                style={s.hpAdjustInput}
                type="number"
                min={1}
                placeholder="amt"
                value={hpAdjustVal}
                onChange={(e) => setHpAdjustVal(e.target.value)}
                onKeyDown={(e) => {
                  const n = parseInt(hpAdjustVal, 10);
                  if (!n || n <= 0) return;
                  if (e.key === 'Enter') { onAdjustHp(-n); setHpAdjustVal(''); }
                  if (e.key === 'h' || e.key === 'H') { onAdjustHp(n); setHpAdjustVal(''); }
                }}
              />
              <button
                style={s.dmgBtn}
                disabled={!hpAdjustVal || parseInt(hpAdjustVal, 10) <= 0}
                onClick={() => { const n = parseInt(hpAdjustVal, 10); if (n > 0) { onAdjustHp(-n); setHpAdjustVal(''); } }}
              >DMG</button>
              <button
                style={s.healBtn}
                disabled={!hpAdjustVal || parseInt(hpAdjustVal, 10) <= 0}
                onClick={() => { const n = parseInt(hpAdjustVal, 10); if (n > 0) { onAdjustHp(n); setHpAdjustVal(''); } }}
              >HEAL</button>
            </div>
          </>
        )}
      </div>
    </div>
    {editingBase && (
      <AddCombatantForm
        initialValues={{ name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier, type: c.type, color: c.color ?? '#888888', initiative: c.initiative, statBlock: c.statBlock }}
        onSubmit={(values) => { onUpdateBase(values); setEditingBase(false); }}
        onCancel={() => setEditingBase(false)}
      />
    )}
    {showCondPicker && !isGroup && (
      <div style={s.condPicker}>
        {CONDITIONS.map((cond) => {
          const active = c.conditions.find((x) => x === cond.name || x.startsWith(cond.name + ' '));
          const level = active && 'hasLevel' in cond ? parseInt(active.split(' ')[1] ?? '1', 10) : null;
          return (
            <div key={cond.name} style={s.condPickerItem}>
              <button
                style={{ ...s.condPickerBtn, ...(active ? s.condPickerBtnActive : {}) }}
                onClick={() => toggleCondition(cond.name, 'hasLevel' in cond ? cond.hasLevel : undefined)}
              >
                <span style={s.condPickerIcon}>{cond.icon}</span>
                <span style={s.condPickerName}>{cond.name}</span>
              </button>
              {active && 'hasLevel' in cond && (
                <div style={s.condLevelControls}>
                  <button style={s.condLevelBtn} onClick={() => adjustExhaustion(-1)} disabled={level === 1}>−</button>
                  <span style={s.condLevelVal}>{level}</span>
                  <button style={s.condLevelBtn} onClick={() => adjustExhaustion(1)} disabled={level === 6}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
    </div>
  );
}

// Small inline HP display for group members with click-to-edit
function MemberHpDisplay({ member, onSet }: { member: { currentHp: number; maxHp: number }; onSet: (val: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        style={{ ...s.hpInput, width: 48, fontSize: '0.75rem' }}
        type="number"
        autoFocus
        defaultValue={member.currentHp}
        min={0}
        max={member.maxHp}
        onBlur={(e) => { onSet(Number(e.target.value)); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <span style={{ ...s.hpText, fontSize: '0.8rem', minWidth: 48, cursor: 'pointer' }} onClick={() => setEditing(true)} title="Click to edit">
      {member.currentHp}<span style={s.hpMax}>/{member.maxHp}</span>
    </span>
  );
}

// Small inline label display for group members with click-to-edit + persist
function MemberLabelDisplay({ memberId, label, onRename }: { memberId: number; label: string; onRename: (label: string) => void }) {
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
      onRename(trimmed);
    } else {
      setDraft(label);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        style={{ ...s.hpInput, width: 80, fontSize: '0.75rem' }}
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
    <span style={{ ...s.memberLabel, cursor: 'pointer' }} onClick={() => { setDraft(label); setEditing(true); }} title="Click to rename">
      {label}
    </span>
  );
}

// ── AddCombatantForm ──────────────────────────────────────────────────────────

function AddCombatantForm({
  onSubmit,
  onCancel,
  initialValues,
}: {
  onSubmit: (v: { name: string; maxHp: number; initiativeModifier: number; type: RunCombatant['type']; color: string; description: string | null; visibleToPlayers: boolean; initiative: number | null; statBlock?: string; members?: { label: string; maxHp: number }[] }) => void;
  onCancel: () => void;
  initialValues?: { name: string; maxHp: number; initiativeModifier: number; type: RunCombatant['type']; color: string; initiative: number | null; statBlock?: string | null };
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [maxHp, setMaxHp] = useState(initialValues?.maxHp ?? 10);
  const [initMod, setInitMod] = useState(initialValues?.initiativeModifier ?? 0);
  const [initiative, setInitiative] = useState(initialValues?.initiative != null ? String(initialValues.initiative) : '');
  const [type, setType] = useState<RunCombatant['type']>(initialValues?.type ?? 'enemy');
  const [color, setColor] = useState(initialValues?.color ?? '#888888');
  const [description, setDescription] = useState('');
  const [visibleToPlayers, setVisibleToPlayers] = useState(true);
  const [members, setMembers] = useState<{ label: string; maxHp: number }[]>([]);
  const [pendingStatBlock, setPendingStatBlock] = useState<string | undefined>(initialValues?.statBlock ?? undefined);
  const [showSbEditor, setShowSbEditor] = useState(false);

  function addMember() {
    setMembers((prev) => [...prev, { label: '', maxHp: 10 }]);
  }

  function updateMember(i: number, field: 'label' | 'maxHp', value: string | number) {
    setMembers((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }

  function removeMember(i: number) {
    setMembers((prev) => prev.filter((_, idx) => idx !== i));
  }

  const isGroup = type === 'group';
  const isGroupInvalid = isGroup && members.length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isGroupInvalid) return;
    const computedMaxHp = isGroup ? members.reduce((sum, m) => sum + m.maxHp, 0) : maxHp;
    const isGmOnly = type === 'event' || type === 'lair';
    onSubmit({
      name: name.trim(),
      maxHp: computedMaxHp,
      initiativeModifier: initMod,
      type,
      color,
      description: description.trim() || null,
      visibleToPlayers: isGmOnly ? false : visibleToPlayers,
      initiative: initiative === '' ? null : Number(initiative),
      statBlock: pendingStatBlock,
      ...(isGroup ? { members } : {}),
    });
  }

  return (
    <form style={s.addForm} onSubmit={handleSubmit}>
      <Open5eSearch
        style={{ marginBottom: 8 }}
        onSelect={(m) => { setName(m.name); setMaxHp(m.maxHp); setInitMod(m.initiativeModifier); setType('enemy'); setPendingStatBlock(m.statBlock); }}
      />
      <div style={s.addFormRow}>
        <input style={{ ...s.addInput, flex: 2 }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {!isGroup && type !== 'event' && type !== 'lair' && (
          <label style={s.addLabel}>HP<input style={{ ...s.addInput, width: 64 }} type="number" min={1} value={maxHp} onChange={(e) => setMaxHp(Number(e.target.value))} /></label>
        )}
        <label style={s.addLabel}>Init mod<input style={{ ...s.addInput, width: 60 }} type="number" value={initMod} onChange={(e) => setInitMod(Number(e.target.value))} /></label>
        <label style={s.addLabel}>Initiative<input style={{ ...s.addInput, width: 60 }} type="number" placeholder="—" value={initiative} onChange={(e) => setInitiative(e.target.value)} /></label>
        <select style={s.addInput} value={type} onChange={(e) => setType(e.target.value as RunCombatant['type'])}>
          <option value="enemy">Enemy</option>
          <option value="npc">NPC</option>
          <option value="pc">PC</option>
          <option value="group">Group</option>
          <option value="event">Event</option>
          <option value="lair">Lair Action</option>
        </select>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 36, height: 32, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
        {type !== 'event' && type !== 'lair' && (
          <button
            type="button"
            style={{ ...s.btnGhost, padding: '4px 10px', color: visibleToPlayers ? '#4caf50' : '#555', fontSize: '0.95rem' }}
            title={visibleToPlayers ? 'Visible to players' : 'Hidden from players'}
            onClick={() => setVisibleToPlayers((v) => !v)}
          >👁</button>
        )}
        <button style={s.btnSecondary} type="submit" disabled={!name.trim() || isGroupInvalid}>
          {initialValues ? 'Save' : 'Add'}
        </button>
        {type !== 'event' && type !== 'lair' && (
          <button
            type="button"
            style={{ ...s.btnGhost, color: pendingStatBlock ? '#c9a84c' : '#666' }}
            onClick={() => setShowSbEditor(true)}
            title={pendingStatBlock ? 'Edit stat block' : 'Create stat block'}
          >
            📖 {pendingStatBlock ? 'Edit Stat Block' : 'Stat Block'}
          </button>
        )}
        <button style={s.btnGhost} type="button" onClick={onCancel}>Cancel</button>
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
          style={{ ...s.addInput, width: '100%', marginTop: 8, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder="Description (GM only — what happens when this triggers)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : (type === 'enemy' || type === 'group' || type === 'npc') ? (
        <textarea
          style={{ ...s.addInput, width: '100%', marginTop: 8, minHeight: 48, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder="Notes (GM only — tactics, abilities, reminders)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : null}
      {isGroup && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Members ({members.length})</span>
            <button type="button" style={{ ...s.btnGhost, padding: '3px 10px', fontSize: '0.75rem' }} onClick={addMember}>+ Add Member</button>
          </div>
          {members.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <input
                style={{ ...s.addInput, width: 80 }}
                placeholder="Label"
                value={m.label}
                onChange={(e) => updateMember(i, 'label', e.target.value)}
              />
              <label style={s.addLabel}>
                HP
                <input
                  style={{ ...s.addInput, width: 60 }}
                  type="number"
                  min={1}
                  value={m.maxHp}
                  onChange={(e) => updateMember(i, 'maxHp', Number(e.target.value))}
                />
              </label>
              <button type="button" style={{ ...s.btnGhost, padding: '3px 7px', fontSize: '0.75rem' }} onClick={() => removeMember(i)}>✕</button>
            </div>
          ))}
          {members.length === 0 && <p style={{ color: '#666', fontSize: '0.75rem', fontStyle: 'italic', margin: 0 }}>Add at least one member.</p>}
        </div>
      )}
    </form>
  );
}

// ── LegendaryWidget ───────────────────────────────────────────────────────────

function LegendaryWidget({ max, remaining, onSpend, onRestore, onReset, onSetMax }: {
  max: number; remaining: number;
  onSpend: () => void; onRestore: () => void; onReset: () => void; onSetMax: (n: number) => void;
}) {
  return (
    <div style={lwWrap} title="Legendary actions">
      <span style={lwLabel}>⚡</span>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          style={{ ...lwPip, color: i < remaining ? '#ffd54f' : '#333', cursor: 'pointer' }}
          onClick={i < remaining ? onSpend : onRestore}
          title={i < remaining ? 'Spend legendary action' : 'Restore one legendary action'}
        >●</button>
      ))}
      <button style={lwReset} onClick={onReset} title="Reset all">↺</button>
      <button style={lwAdj} onClick={() => onSetMax(Math.max(1, max - 1))} title="Reduce max">−</button>
      <button style={lwAdj} onClick={() => onSetMax(max + 1)} title="Increase max">+</button>
    </div>
  );
}

// ── ResistanceWidget ──────────────────────────────────────────────────────────

function ResistanceWidget({ max, remaining, onSpend, onRestore, onSetMax }: {
  max: number; remaining: number;
  onSpend: () => void; onRestore: () => void; onSetMax: (n: number) => void;
}) {
  return (
    <div style={rwWrap} title="Legendary resistances (do not reset automatically)">
      <span style={rwLabel}>🛡</span>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          style={{ ...rwPip, color: i < remaining ? '#4dd0e1' : '#1a3a3a', cursor: 'pointer' }}
          onClick={i < remaining ? onSpend : onRestore}
          title={i < remaining ? 'Spend legendary resistance' : 'Restore one legendary resistance'}
        >◆</button>
      ))}
      <button style={rwAdj} onClick={() => onSetMax(Math.max(1, max - 1))} title="Reduce max">−</button>
      <button style={rwAdj} onClick={() => onSetMax(max + 1)} title="Increase max">+</button>
    </div>
  );
}

const rwWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2,
  background: '#0a1e22', border: '1px solid #1a4a4a',
  borderRadius: 4, padding: '2px 6px', flexShrink: 0,
};
const rwLabel: React.CSSProperties = { fontSize: '0.75rem', marginRight: 2 };
const rwPip: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: '0.85rem',
  padding: '0 1px', lineHeight: 1,
};
const rwAdj: React.CSSProperties = {
  background: 'none', border: '1px solid #1a4a4a', borderRadius: 3,
  color: '#4dd0e1', cursor: 'pointer', fontSize: '0.65rem',
  padding: '0 3px', lineHeight: '1.4', marginLeft: 1,
};

const lwWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2,
  background: '#1a1a0a', border: '1px solid #4a4a1e',
  borderRadius: 4, padding: '2px 6px', flexShrink: 0,
};
const lwLabel: React.CSSProperties = { fontSize: '0.75rem', marginRight: 2 };
const lwPip: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: '0.85rem',
  padding: '0 1px', lineHeight: 1,
};
const lwReset: React.CSSProperties = {
  background: 'none', border: 'none', color: '#888', cursor: 'pointer',
  fontSize: '0.8rem', padding: '0 2px', lineHeight: 1, marginLeft: 2,
};
const lwAdj: React.CSSProperties = {
  background: 'none', border: '1px solid #333', borderRadius: 3,
  color: '#666', cursor: 'pointer', fontSize: '0.65rem',
  padding: '0 3px', lineHeight: '1.4', marginLeft: 1,
};

// ── RechargeWidget ────────────────────────────────────────────────────────────

function RechargeWidget({ name, min, used, isActive, onToggle }: {
  name: string; min: number; used: boolean; isActive: boolean; onToggle: () => void;
}) {
  const needsRoll = used && isActive;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: needsRoll ? '#3a2a0a' : (used ? '#1a1a1a' : '#0a1a0a'),
        border: `1px solid ${needsRoll ? '#c9a84c' : (used ? '#333' : '#2a4a2a')}`,
        borderRadius: 4, padding: '2px 7px', flexShrink: 0,
        transition: 'background 0.2s, border-color 0.2s',
      }}
      title={used ? (needsRoll ? `Roll d6 — recharges on ${min}–6` : `${name} used`) : `${name} available`}
    >
      <button
        onClick={onToggle}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.85rem', padding: '0 1px', lineHeight: 1,
          color: used ? '#444' : '#4caf50',
        }}
        title={used ? 'Mark as recharged' : 'Mark as used'}
      >{used ? '○' : '●'}</button>
      {needsRoll && <span style={{ fontSize: '0.75rem' }}>🎲</span>}
      <span style={{ fontSize: '0.72rem', color: needsRoll ? '#c9a84c' : (used ? '#555' : '#888'), fontWeight: needsRoll ? 600 : 400 }}>
        {name} ({min}–6)
      </span>
    </div>
  );
}

// ── StatBlockPanel ────────────────────────────────────────────────────────────

interface SBAction {
  name: string;
  desc: string;
  action_type?: string;
  legendary_action_cost?: number;
  usage_limits?: { type: string; param?: number } | null;
}
interface StatBlockData {
  name?: string;
  size?: { name?: string };
  type?: { name?: string };
  alignment?: string;
  armor_class?: number;
  armor_detail?: string;
  hit_points?: number;
  hit_dice?: string;
  challenge_rating?: number;
  speed?: Record<string, number | boolean | string>;
  ability_scores?: Record<string, number>;
  modifiers?: Record<string, number>;
  saving_throws?: Record<string, number>;
  skill_bonuses?: Record<string, number>;
  passive_perception?: number;
  resistances_and_immunities?: {
    damage_resistances_display?: string;
    damage_immunities_display?: string;
    damage_vulnerabilities_display?: string;
    condition_immunities_display?: string;
  };
  darkvision_range?: number | null;
  blindsight_range?: number | null;
  tremorsense_range?: number | null;
  truesight_range?: number | null;
  languages?: { as_string?: string };
  traits?: { name: string; desc: string }[];
  actions?: SBAction[];
}

function fmod(n: number | undefined) {
  if (n == null) return '—';
  return n >= 0 ? `+${n}` : `${n}`;
}

function StatBlockPanel({ combatant, onClose, onEditStatBlock }: { combatant: RunCombatant; onClose: () => void; onEditStatBlock?: (json: string) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <StatBlockEditor
        initialData={combatant.statBlock}
        onSave={(json) => { onEditStatBlock?.(json); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  let sb: StatBlockData = {};
  try { sb = JSON.parse(combatant.statBlock ?? '{}'); } catch {}

  const typeName = sb.type?.name ?? '';
  const sizeName = sb.size?.name ?? '';

  const speedParts = sb.speed
    ? Object.entries(sb.speed).filter(([k, v]) => k !== 'unit' && typeof v === 'number' && (v as number) > 0).map(([k, v]) => `${k} ${v}ft`)
    : [];

  const scores = sb.ability_scores ?? {};
  const mods = sb.modifiers ?? {};
  const saves = sb.saving_throws ?? {};
  const skills = sb.skill_bonuses ?? {};

  // Only show saves that differ from the base modifier (i.e. have proficiency)
  const profSaves = Object.entries(saves).filter(([k, v]) => v !== mods[k]);

  const ri = sb.resistances_and_immunities ?? {};

  const senses: string[] = [];
  if (sb.darkvision_range) senses.push(`Darkvision ${sb.darkvision_range}ft`);
  if (sb.blindsight_range) senses.push(`Blindsight ${sb.blindsight_range}ft`);
  if (sb.tremorsense_range) senses.push(`Tremorsense ${sb.tremorsense_range}ft`);
  if (sb.truesight_range) senses.push(`Truesight ${sb.truesight_range}ft`);
  if (sb.passive_perception != null) senses.push(`Passive Perception ${sb.passive_perception}`);

  const allActions = sb.actions ?? [];
  const actions = allActions.filter((a) => a.action_type === 'ACTION');
  const bonusActions = allActions.filter((a) => a.action_type === 'BONUS_ACTION');
  const reactions = allActions.filter((a) => a.action_type === 'REACTION');
  const legendary = allActions.filter((a) => a.action_type === 'LEGENDARY_ACTION');

  function actionLabel(a: SBAction) {
    let label = a.name;
    if (a.usage_limits?.type === 'RECHARGE_ON_ROLL' && a.usage_limits.param != null) {
      label += ` (Recharge ${a.usage_limits.param}–6)`;
    } else if (a.usage_limits?.type === 'PER_DAY' && a.usage_limits.param != null) {
      label += ` (${a.usage_limits.param}/Day)`;
    }
    if (a.legendary_action_cost && a.legendary_action_cost > 1) {
      label += ` (Costs ${a.legendary_action_cost})`;
    }
    return label;
  }

  function ActionBlock({ items, title }: { items: SBAction[]; title: string }) {
    if (items.length === 0) return null;
    return (
      <div style={sbSection}>
        <div style={sbSectionTitle}>{title}</div>
        {items.map((a) => (
          <p key={a.name} style={sbAction}>
            <strong style={{ color: '#e0e0e0' }}>{actionLabel(a)}.</strong>{' '}
            <span style={{ color: '#bbb' }}>{a.desc}</span>
          </p>
        ))}
      </div>
    );
  }

  return (
    <div style={sbOverlay} onClick={onClose}>
      <div style={sbDrawer} onClick={(e) => e.stopPropagation()}>
        <div style={sbHeader}>
          <div>
            <div style={sbName}>{sb.name ?? combatant.name}</div>
            <div style={sbSubtitle}>{[sizeName, typeName, sb.alignment].filter(Boolean).join(', ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {onEditStatBlock && (
              <button style={sbCloseBtn} onClick={() => setEditing(true)} title="Edit stat block">✎ Edit</button>
            )}
            <button style={sbCloseBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={sbDivider} />

        <div style={sbRow}>
          {sb.armor_class != null && <span style={sbStat}><strong>AC</strong> {sb.armor_class}{sb.armor_detail ? ` (${sb.armor_detail})` : ''}</span>}
          {sb.hit_points != null && <span style={sbStat}><strong>HP</strong> {sb.hit_points}{sb.hit_dice ? ` (${sb.hit_dice})` : ''}</span>}
          {speedParts.length > 0 && <span style={sbStat}><strong>Speed</strong> {speedParts.join(', ')}</span>}
          {sb.challenge_rating != null && <span style={sbStat}><strong>CR</strong> {sb.challenge_rating}</span>}
        </div>

        <div style={sbDivider} />

        <div style={sbAbilityRow}>
          {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((label, i) => {
            const key = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'][i];
            return (
              <div key={label} style={sbAbility}>
                <div style={sbAbilityLabel}>{label}</div>
                <div style={sbAbilityScore}>{scores[key] ?? '—'}</div>
                <div style={sbAbilityMod}>{fmod(mods[key])}</div>
              </div>
            );
          })}
        </div>

        <div style={sbDivider} />

        <div style={sbInfoBlock}>
          {profSaves.length > 0 && (
            <div style={sbInfoLine}><strong>Saves</strong> {profSaves.map(([k, v]) => `${k.slice(0,3).toUpperCase()} ${fmod(v)}`).join(', ')}</div>
          )}
          {Object.keys(skills).length > 0 && (
            <div style={sbInfoLine}><strong>Skills</strong> {Object.entries(skills).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')} ${fmod(v)}`).join(', ')}</div>
          )}
          {ri.damage_vulnerabilities_display && <div style={{ ...sbInfoLine, color: '#ef9a9a' }}><strong>Vulnerabilities</strong> {ri.damage_vulnerabilities_display}</div>}
          {ri.damage_resistances_display && <div style={{ ...sbInfoLine, color: '#80cbc4' }}><strong>Resistances</strong> {ri.damage_resistances_display}</div>}
          {ri.damage_immunities_display && <div style={{ ...sbInfoLine, color: '#a5d6a7' }}><strong>Immunities</strong> {ri.damage_immunities_display}</div>}
          {ri.condition_immunities_display && <div style={sbInfoLine}><strong>Condition Immunities</strong> {ri.condition_immunities_display}</div>}
          {senses.length > 0 && <div style={sbInfoLine}><strong>Senses</strong> {senses.join(', ')}</div>}
          {sb.languages?.as_string && <div style={sbInfoLine}><strong>Languages</strong> {sb.languages.as_string}</div>}
        </div>

        <ActionBlock items={sb.traits ?? []} title="Traits" />
        <ActionBlock items={actions} title="Actions" />
        <ActionBlock items={bonusActions} title="Bonus Actions" />
        <ActionBlock items={reactions} title="Reactions" />
        <ActionBlock items={legendary} title="Legendary Actions" />
      </div>
    </div>
  );
}

const sbOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
  display: 'flex', justifyContent: 'flex-end',
};
const sbDrawer: React.CSSProperties = {
  width: 420, maxWidth: '95vw', height: '100vh', overflowY: 'auto',
  background: '#16213e', borderLeft: '1px solid #2a2a4a',
  padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0,
};
const sbHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 };
const sbName: React.CSSProperties = { fontSize: '1.3rem', fontWeight: 700, color: '#c9a84c' };
const sbSubtitle: React.CSSProperties = { fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: 2 };
const sbCloseBtn: React.CSSProperties = { background: 'none', border: '1px solid #444', borderRadius: 4, color: '#888', cursor: 'pointer', padding: '4px 8px', fontSize: '0.8rem', flexShrink: 0 };
const sbDivider: React.CSSProperties = { borderBottom: '1px solid #8b3a1a', margin: '10px 0' };
const sbRow: React.CSSProperties = { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 };
const sbStat: React.CSSProperties = { fontSize: '0.85rem', color: '#ccc' };
const sbAbilityRow: React.CSSProperties = { display: 'flex', gap: 0, justifyContent: 'space-between', margin: '4px 0' };
const sbAbility: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 };
const sbAbilityLabel: React.CSSProperties = { fontSize: '0.7rem', color: '#c9a84c', fontWeight: 700, letterSpacing: '0.05em' };
const sbAbilityScore: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, color: '#e0e0e0' };
const sbAbilityMod: React.CSSProperties = { fontSize: '0.75rem', color: '#aaa' };
const sbInfoBlock: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 };
const sbInfoLine: React.CSSProperties = { fontSize: '0.8rem', color: '#ccc', lineHeight: 1.5 };
const sbSection: React.CSSProperties = { marginTop: 10 };
const sbSectionTitle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: '#c9a84c', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #8b3a1a', paddingBottom: 4, marginBottom: 6 };
const sbAction: React.CSSProperties = { fontSize: '0.8rem', margin: '0 0 6px', lineHeight: 1.5 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function hpColor(pct: number) {
  if (pct > 60) return '#4caf50';
  if (pct > 25) return '#ff9800';
  return '#ef5350';
}

function typeStyle(type: RunCombatant['type']): React.CSSProperties {
  if (type === 'pc') return { background: '#1a3a1a', color: '#4caf50', borderColor: '#2d5a2d' };
  if (type === 'npc') return { background: '#1a2a3a', color: '#64b5f6', borderColor: '#1e3a5a' };
  if (type === 'group') return { background: '#2a1a3a', color: '#ce93d8', borderColor: '#4a2a5a' };
  if (type === 'event') return { background: '#2a2a1a', color: '#ffd54f', borderColor: '#4a4a1e' };
  if (type === 'lair') return { background: '#1a2a2a', color: '#80cbc4', borderColor: '#1e4a4a' };
  return { background: '#3a1a1a', color: '#ef5350', borderColor: '#5a1e1e' };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', paddingBottom: 60 },
  back: { color: '#c9a84c', textDecoration: 'none', fontSize: '0.875rem', whiteSpace: 'nowrap' },
  title: { margin: 0, fontSize: '1.4rem', color: '#c9a84c', flexShrink: 1, minWidth: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  headerActions: { display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'nowrap' as const },
  activeNav: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#0f0f1f', border: '1px solid #2a2a4a', borderRadius: 6,
    padding: '4px 8px', flexShrink: 0, minWidth: 0,
  },
  roundLabel: {
    fontSize: '0.75rem', color: '#888', fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    paddingRight: 6, borderRight: '1px solid #2a2a4a',
  },
  navBtn: {
    background: 'none', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#c9a84c', cursor: 'pointer', fontSize: '0.9rem',
    padding: '4px 10px', lineHeight: 1,
  },
  activeName: {
    fontSize: '0.9rem', color: '#c9a84c', fontWeight: 600,
    width: 120, textAlign: 'center' as const,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  main: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto' },
  muted: { color: '#666', fontStyle: 'italic' },

  table: { display: 'flex', flexDirection: 'column', gap: 6 },
  rowWrapper: { display: 'flex', flexDirection: 'column' as const },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', background: '#16213e',
    border: '1px solid #2a2a4a', borderLeft: '4px solid #444',
    borderRadius: 8, flexWrap: 'wrap',
  },

  // Initiative cell
  initCell: { display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 },
  initValue: {
    fontSize: '1.4rem', fontWeight: 700, color: '#c9a84c',
    minWidth: 36, textAlign: 'center', cursor: 'pointer',
  },
  initEmpty: {
    fontSize: '1.4rem', color: '#444',
    minWidth: 36, textAlign: 'center', cursor: 'pointer',
  },
  initInput: {
    width: 50, background: '#0f0f1f', border: '1px solid #c9a84c',
    borderRadius: 4, color: '#c9a84c', fontSize: '1.2rem',
    textAlign: 'center', padding: '2px 4px',
  },
  rollBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '1.1rem', padding: 2, lineHeight: 1,
  },

  editBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#666', fontSize: '1rem', padding: '0 2px', lineHeight: 1,
  },
  // Name cell
  nameCell: { flex: 2, display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, flexWrap: 'wrap' as const },
  name: { fontSize: '1rem', fontWeight: 500 },
  deadName: { fontSize: '1rem', fontWeight: 500, textDecoration: 'line-through', color: '#555' },
  typeBadge: {
    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10,
    border: '1px solid', textTransform: 'capitalize' as const, flexShrink: 0,
  },
  pcStat: {
    fontSize: '0.7rem', color: '#90caf9', background: '#1a2a3a',
    border: '1px solid #1e3a5a', borderRadius: 4, padding: '1px 6px', flexShrink: 0,
  },

  // HP cell
  hpCell: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 380, flex: 3 },
  hpBarTrack: {
    height: 4, background: '#2a2a4a', borderRadius: 2, overflow: 'hidden',
  },
  hpBarFill: { height: '100%', borderRadius: 2, transition: 'width 0.2s, background 0.2s' },
  hpControls: { display: 'flex', alignItems: 'center', gap: 4 },
  hpText: {
    fontSize: '1rem', fontWeight: 600, minWidth: 72, textAlign: 'center',
    cursor: 'pointer', padding: '0 4px',
  },
  hpMax: { fontSize: '0.75rem', color: '#666', fontWeight: 400 },
  hpInput: {
    width: 64, background: '#0f0f1f', border: '1px solid #4caf50',
    borderRadius: 4, color: '#e0e0e0', fontSize: '1rem',
    textAlign: 'center', padding: '2px 4px',
  },
  hpAdjustInput: {
    width: 52, background: '#0f0f1f', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', fontSize: '0.75rem', textAlign: 'center' as const,
    padding: '3px 4px', marginLeft: 6,
  },
  dmgBtn: {
    padding: '3px 7px', background: '#3a1a1a', color: '#ef5350',
    border: '1px solid #5a1e1e', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600,
  },
  healBtn: {
    padding: '3px 7px', background: '#1a3a1a', color: '#4caf50',
    border: '1px solid #2d5a2d', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600,
  },
  dmgBtnSm: {
    padding: '2px 5px', background: '#3a1a1a', color: '#ef5350',
    border: '1px solid #5a1e1e', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.65rem', fontWeight: 600,
  },
  healBtnSm: {
    padding: '2px 5px', background: '#1a3a1a', color: '#4caf50',
    border: '1px solid #2d5a2d', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.65rem', fontWeight: 600,
  },
  memberRow: {
    display: 'flex', alignItems: 'center', gap: 4,
  },
  memberLabel: {
    fontSize: '0.75rem', color: '#ce93d8', fontWeight: 600,
    minWidth: 24, flexShrink: 0,
  },

  // Condition badges & picker
  condBadge: {
    fontSize: '1rem', cursor: 'pointer', lineHeight: 1,
  },
  condPicker: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 6,
    padding: '10px 14px', background: '#0f0f1f',
    borderTop: '1px solid #2a2a4a',
  },
  condPickerItem: { display: 'flex', alignItems: 'center', gap: 4 },
  condPickerBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', background: '#1a1a2e',
    border: '1px solid #3a3a5a', borderRadius: 4,
    cursor: 'pointer', color: '#888', fontSize: '0.8rem',
  },
  condPickerBtnActive: {
    background: '#2a1a3a', border: '1px solid #8a4af0',
    color: '#ce93d8',
  },
  condPickerIcon: { fontSize: '1rem', lineHeight: 1 },
  condPickerName: { fontSize: '0.75rem', whiteSpace: 'nowrap' as const },
  condLevelControls: { display: 'flex', alignItems: 'center', gap: 3 },
  condLevelBtn: {
    background: '#2a2a4a', border: '1px solid #4a4a6a', borderRadius: 3,
    color: '#e0e0e0', cursor: 'pointer', fontSize: '0.75rem',
    padding: '2px 6px', lineHeight: 1,
  },
  condLevelVal: { fontSize: '0.8rem', color: '#c9a84c', fontWeight: 700, minWidth: 16, textAlign: 'center' as const },

  // Add combatant form
  addForm: {
    background: '#16213e', border: '1px solid #2a2a4a',
    borderRadius: 8, padding: '12px 14px', marginBottom: 12,
  },
  addFormRow: { display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' as const },
  addInput: {
    background: '#0f0f1f', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '6px 10px', fontSize: '0.875rem',
  },
  addLabel: {
    display: 'flex', flexDirection: 'column' as const, gap: 3,
    fontSize: '0.7rem', color: '#888',
  },

  // Header buttons (full size — rightSlot / navBtn context)
  btnSecondary: {
    padding: '7px 14px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem',
    whiteSpace: 'nowrap' as const,
  },
  btnActive: {
    padding: '7px 14px', background: '#2d4a2d', color: '#4caf50',
    border: '1px solid #3d6a3d', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  btnGhost: {
    padding: '7px 14px', background: 'transparent', color: '#666',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem',
    whiteSpace: 'nowrap' as const,
  },
  btnDanger: {
    padding: '7px 14px', background: 'transparent', color: '#ef5350',
    border: '1px solid #ef5350', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem',
    whiteSpace: 'nowrap' as const,
  },
  // Compact header action buttons
  btnHdr: {
    padding: '5px 8px', background: 'transparent', color: '#c9a84c',
    border: '1px solid #c9a84c', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem',
    whiteSpace: 'nowrap' as const,
  },
  btnHdrActive: {
    padding: '5px 8px', background: '#2d4a2d', color: '#4caf50',
    border: '1px solid #3d6a3d', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  btnHdrDanger: {
    padding: '5px 8px', background: 'transparent', color: '#ef5350',
    border: '1px solid #ef5350', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem',
    whiteSpace: 'nowrap' as const,
  },
};
