// ── Domain models ────────────────────────────────────────────────────────────

export interface Adventure {
  id: number;
  name: string;
  description: string | null;
  showHp: boolean;
  showInitiative: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SceneFit = 'cover' | 'fit' | 'center';

export interface ImageScene {
  id: number;
  adventureId: number;
  name: string;
  sortOrder: number;
}

export interface SceneImage {
  id: number;
  sceneId: number;
  filePath: string;
  sortOrder: number;
  fit: SceneFit;
}

export interface AdventurePlayer {
  id: number;
  adventureId: number;
  name: string;
  maxHp: number;
  initiativeModifier: number;
  color: string | null;
}

export interface Encounter {
  id: number;
  adventureId: number;
  name: string;
  description: string | null;
}

export type CombatantType = 'pc' | 'npc' | 'enemy' | 'group' | 'event' | 'lair';

export interface GroupMember {
  id: number;
  combatantId: number;
  label: string;
  maxHp: number;
}

export interface Combatant {
  id: number;
  encounterId: number;
  name: string;
  maxHp: number;
  initiativeModifier: number;
  type: CombatantType;
  color: string | null;
}

export interface Session {
  id: number;
  adventureId: number;
  name: string;
  date: string;
  notes: string | null;
}

// ── Live session (in-memory, not persisted) ──────────────────────────────────

export interface LiveCombatant {
  id: number;
  name: string;
  currentHp: number;
  maxHp: number;
  initiative: number | null;
  type: CombatantType;
  color: string | null;
  conditions: string[];
  members?: { id: number; label: string; currentHp: number; maxHp: number; conditions?: string[] }[];
}

// ── BroadcastChannel message types ──────────────────────────────────────────

export type BroadcastMessage =
  | { type: 'SHOW_IMAGE'; payload: { filePath: string; fit: SceneFit } }
  | { type: 'CLEAR_IMAGE' }
  | { type: 'UPDATE_INITIATIVE'; payload: { combatants: LiveCombatant[]; activeCombatantId?: number | null; round?: number } }
  | { type: 'TOGGLE_INITIATIVE'; payload: { visible: boolean } }
  | { type: 'SET_SHOW_HP'; payload: { showHp: boolean } }
  | { type: 'SET_SHOW_INITIATIVE'; payload: { showInitiative: boolean } }
  | { type: 'COMBATANT_UPDATED'; payload: { encounterId: number; combatant: { id: number; name: string; maxHp: number; initiativeModifier: number; type: CombatantType; color: string | null; members?: { id: number; label: string; maxHp: number }[] } } }
  | { type: 'COMBATANT_ADDED'; payload: { encounterId: number; combatant: { id: number; name: string; maxHp: number; initiativeModifier: number; type: CombatantType; color: string | null; description: string | null; visibleToPlayers: boolean; statBlock?: string | null; members?: { id: number; label: string; maxHp: number }[] } } }
  | { type: 'COMBATANT_REMOVED'; payload: { encounterId: number; combatantId: number } };
