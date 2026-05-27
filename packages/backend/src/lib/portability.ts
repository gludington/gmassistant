import { zipSync, unzipSync, type ZipOptions } from 'fflate';
import { eq, inArray, and } from 'drizzle-orm';
import type { AppDb } from '../db/types.js';
import type { StorageAdapter } from '../storage/types.js';
import {
  adventures as adventuresTable,
  playlists as playlistsTable,
  playlistTracks as tracksTable,
  imageScenes as imageScenesTable,
  sceneImages as sceneImagesTable,
  encounters as encountersTable,
  combatants as combatantsTable,
  groupMembers as groupMembersTable,
  adventurePlayers as playersTable,
  sessions as sessionsTable,
} from '../db/schema.js';

export const SCHEMA_VERSION = 1;

// ─── Public types ─────────────────────────────────────────────────────────────

export type ExportType = 'adventure' | 'playlist' | 'encounter';

export interface ExportManifest {
  type: ExportType;
  schemaVersion: number;
  exportedAt: string;
  name: string;
}

export interface ImportConflict {
  id: string;
  type: 'adventure' | 'playlist' | 'encounter';
  name: string;
  existingId: number;
  suggestedNewName: string;
}

export type ConflictAction = 'replace' | 'rename' | 'skip';
export interface ConflictResolution { action: ConflictAction; newName?: string }
export type Resolutions = Record<string, ConflictResolution>;

// ─── Internal data shapes ─────────────────────────────────────────────────────

interface TrackItem {
  name: string; type: 'file' | 'youtube' | 'spotify'; url: string; sortOrder: number;
  fileKey?: string;
}

interface PlaylistItem {
  localId: number; name: string; sortOrder: number;
  playMode: 'sequential' | 'shuffle'; loop: boolean; tracks: TrackItem[];
}

interface CombatantItem {
  name: string; maxHp: number; initiativeModifier: number;
  type: string; color: string | null; description: string | null;
  visibleToPlayers: boolean; statBlock: string | null;
  groupMembers: Array<{ label: string; maxHp: number }>;
}

interface EncounterItem {
  name: string; description: string | null;
  playlistLocalId: number | null; combatants: CombatantItem[];
}

interface ImageItem {
  fileKey: string; sortOrder: number;
  fit: 'cover' | 'fit' | 'center'; playlistLocalId: number | null;
}

interface AdventureData {
  adventure: { name: string; description: string | null; showHp: boolean; showInitiative: boolean };
  players: Array<{ name: string; maxHp: number; initiativeModifier: number; color: string | null; armorClass: number | null; spellDc: number | null; passivePerception: number | null }>;
  sessions: Array<{ name: string; date: string; notes: string | null }>;
  playlists: PlaylistItem[];
  imageScenes: Array<{ name: string; sortOrder: number; images: ImageItem[] }>;
  encounters: EncounterItem[];
}

interface PlaylistData {
  playlist: { name: string; sortOrder: number; playMode: 'sequential' | 'shuffle'; loop: boolean };
  tracks: TrackItem[];
}

interface EncounterData {
  encounter: { name: string; description: string | null };
  combatants: CombatantItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
  flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm',
  mp4: 'audio/mp4', opus: 'audio/opus', wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff', aif: 'audio/aiff',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function mimeFromKey(key: string) {
  return MIME[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

function toArrayBuffer(b: Uint8Array): ArrayBuffer {
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return buf as ArrayBuffer;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function buildZip(manifest: ExportManifest, data: unknown, fileMap: Map<string, Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array | [Uint8Array, ZipOptions]> = {
    'manifest.json': [encoder.encode(JSON.stringify(manifest, null, 2)), { level: 9 }],
    'data.json': [encoder.encode(JSON.stringify(data, null, 2)), { level: 9 }],
  };
  for (const [key, bytes] of fileMap) {
    entries[`uploads/${key}`] = [bytes, { level: 0 }];
  }
  return zipSync(entries);
}

function parseZip(buffer: Uint8Array): { manifest: ExportManifest; data: unknown; files: Map<string, Uint8Array> } {
  const entries = unzipSync(buffer);
  if (!entries['manifest.json']) throw new Error('Not a valid GMA export file');
  const manifest: ExportManifest = JSON.parse(decoder.decode(entries['manifest.json']));
  const data = JSON.parse(decoder.decode(entries['data.json']));
  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith('uploads/')) files.set(path.slice('uploads/'.length), bytes);
  }
  return { manifest, data, files };
}

async function storeFiles(storage: StorageAdapter, files: Map<string, Uint8Array>) {
  for (const [key, bytes] of files) {
    await storage.put(key, toArrayBuffer(bytes), mimeFromKey(key));
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportAdventure(db: AppDb, storage: StorageAdapter, adventureId: number): Promise<Uint8Array> {
  const [adventure] = await db.select().from(adventuresTable).where(eq(adventuresTable.id, adventureId));
  if (!adventure) throw new Error('Adventure not found');

  const players = await db.select().from(playersTable).where(eq(playersTable.adventureId, adventureId));
  const sessionRows = await db.select().from(sessionsTable).where(eq(sessionsTable.adventureId, adventureId));
  const playlistRows = await db.select().from(playlistsTable).where(eq(playlistsTable.adventureId, adventureId)).orderBy(playlistsTable.sortOrder);
  const sceneRows = await db.select().from(imageScenesTable).where(eq(imageScenesTable.adventureId, adventureId)).orderBy(imageScenesTable.sortOrder);
  const encounterRows = await db.select().from(encountersTable).where(eq(encountersTable.adventureId, adventureId));

  const playlistIds = playlistRows.map((p) => p.id);
  const trackRows = playlistIds.length > 0
    ? await db.select().from(tracksTable).where(inArray(tracksTable.playlistId, playlistIds)).orderBy(tracksTable.sortOrder)
    : [];

  const sceneIds = sceneRows.map((s) => s.id);
  const imageRows = sceneIds.length > 0
    ? await db.select().from(sceneImagesTable).where(inArray(sceneImagesTable.sceneId, sceneIds)).orderBy(sceneImagesTable.sortOrder)
    : [];

  const encounterIds = encounterRows.map((e) => e.id);
  const combatantRows = encounterIds.length > 0
    ? await db.select().from(combatantsTable).where(inArray(combatantsTable.encounterId, encounterIds))
    : [];

  const groupIds = combatantRows.filter((c) => c.type === 'group').map((c) => c.id);
  const memberRows = groupIds.length > 0
    ? await db.select().from(groupMembersTable).where(inArray(groupMembersTable.combatantId, groupIds))
    : [];

  const fileKeys = new Set<string>();
  for (const t of trackRows) if (t.type === 'file') fileKeys.add(t.url.replace('/uploads/', ''));
  for (const img of imageRows) fileKeys.add(img.filePath.replace('/uploads/', ''));

  const fileMap = new Map<string, Uint8Array>();
  for (const key of fileKeys) {
    const r = await storage.get(key);
    if (r) fileMap.set(key, await streamToBuffer(r.body));
  }

  const data: AdventureData = {
    adventure: { name: adventure.name, description: adventure.description, showHp: adventure.showHp, showInitiative: adventure.showInitiative },
    players: players.map(({ id: _, adventureId: __, ...p }) => p),
    sessions: sessionRows.map(({ id: _, adventureId: __, ...s }) => s),
    playlists: playlistRows.map((pl) => ({
      localId: pl.id,
      name: pl.name,
      sortOrder: pl.sortOrder,
      playMode: pl.playMode,
      loop: pl.loop,
      tracks: trackRows
        .filter((t) => t.playlistId === pl.id)
        .map((t) => ({
          name: t.name,
          type: t.type,
          url: t.url,
          sortOrder: t.sortOrder,
          ...(t.type === 'file' ? { fileKey: t.url.replace('/uploads/', '') } : {}),
        })),
    })),
    imageScenes: sceneRows.map((sc) => ({
      name: sc.name,
      sortOrder: sc.sortOrder,
      images: imageRows
        .filter((img) => img.sceneId === sc.id)
        .map((img) => ({
          fileKey: img.filePath.replace('/uploads/', ''),
          sortOrder: img.sortOrder,
          fit: img.fit,
          playlistLocalId: img.playlistId,
        })),
    })),
    encounters: encounterRows.map((enc) => ({
      name: enc.name,
      description: enc.description,
      playlistLocalId: enc.playlistId,
      combatants: combatantRows
        .filter((c) => c.encounterId === enc.id)
        .map((c) => ({
          name: c.name,
          maxHp: c.maxHp,
          initiativeModifier: c.initiativeModifier,
          type: c.type,
          color: c.color,
          description: c.description,
          visibleToPlayers: c.visibleToPlayers,
          statBlock: c.statBlock,
          groupMembers: memberRows.filter((m) => m.combatantId === c.id).map(({ label, maxHp }) => ({ label, maxHp })),
        })),
    })),
  };

  return buildZip({ type: 'adventure', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), name: adventure.name }, data, fileMap);
}

export async function exportPlaylist(db: AppDb, storage: StorageAdapter, playlistId: number): Promise<Uint8Array> {
  const [pl] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!pl) throw new Error('Playlist not found');

  const trackRows = await db.select().from(tracksTable).where(eq(tracksTable.playlistId, playlistId)).orderBy(tracksTable.sortOrder);

  const fileMap = new Map<string, Uint8Array>();
  for (const t of trackRows) {
    if (t.type === 'file') {
      const key = t.url.replace('/uploads/', '');
      const r = await storage.get(key);
      if (r) fileMap.set(key, await streamToBuffer(r.body));
    }
  }

  const data: PlaylistData = {
    playlist: { name: pl.name, sortOrder: pl.sortOrder, playMode: pl.playMode, loop: pl.loop },
    tracks: trackRows.map((t) => ({
      name: t.name, type: t.type, url: t.url, sortOrder: t.sortOrder,
      ...(t.type === 'file' ? { fileKey: t.url.replace('/uploads/', '') } : {}),
    })),
  };

  return buildZip({ type: 'playlist', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), name: pl.name }, data, fileMap);
}

export async function exportEncounter(db: AppDb, encounterId: number): Promise<Uint8Array> {
  const [enc] = await db.select().from(encountersTable).where(eq(encountersTable.id, encounterId));
  if (!enc) throw new Error('Encounter not found');

  const combatantRows = await db.select().from(combatantsTable).where(eq(combatantsTable.encounterId, encounterId));
  const groupIds = combatantRows.filter((c) => c.type === 'group').map((c) => c.id);
  const memberRows = groupIds.length > 0
    ? await db.select().from(groupMembersTable).where(inArray(groupMembersTable.combatantId, groupIds))
    : [];

  const data: EncounterData = {
    encounter: { name: enc.name, description: enc.description },
    combatants: combatantRows.map((c) => ({
      name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier,
      type: c.type, color: c.color, description: c.description,
      visibleToPlayers: c.visibleToPlayers, statBlock: c.statBlock,
      groupMembers: memberRows.filter((m) => m.combatantId === c.id).map(({ label, maxHp }) => ({ label, maxHp })),
    })),
  };

  return buildZip({ type: 'encounter', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), name: enc.name }, data, new Map());
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function analyzeImport(db: AppDb, buffer: Uint8Array, targetAdventureId?: number): Promise<
  | { needsTarget: true; type: ExportType; name: string }
  | { needsTarget: false; conflicts: ImportConflict[]; type: ExportType; name: string }
> {
  const { manifest, data } = parseZip(buffer);

  if ((manifest.type === 'playlist' || manifest.type === 'encounter') && !targetAdventureId) {
    return { needsTarget: true, type: manifest.type, name: manifest.name };
  }

  const conflicts = await findConflicts(db, manifest.type, data, targetAdventureId);
  return { needsTarget: false, conflicts, type: manifest.type, name: manifest.name };
}

async function findConflicts(db: AppDb, type: ExportType, data: unknown, targetAdventureId?: number): Promise<ImportConflict[]> {
  if (type === 'adventure') {
    const d = data as AdventureData;
    const rows = await db.select({ id: adventuresTable.id }).from(adventuresTable)
      .where(eq(adventuresTable.name, d.adventure.name));
    if (rows.length === 0) return [];
    return [{ id: `adventure:${d.adventure.name}`, type: 'adventure', name: d.adventure.name, existingId: rows[0].id, suggestedNewName: `${d.adventure.name} (imported)` }];
  }

  if (type === 'playlist' && targetAdventureId) {
    const d = data as PlaylistData;
    const rows = await db.select({ id: playlistsTable.id }).from(playlistsTable)
      .where(and(eq(playlistsTable.adventureId, targetAdventureId), eq(playlistsTable.name, d.playlist.name)));
    if (rows.length === 0) return [];
    return [{ id: `playlist:${d.playlist.name}`, type: 'playlist', name: d.playlist.name, existingId: rows[0].id, suggestedNewName: `${d.playlist.name} (imported)` }];
  }

  if (type === 'encounter' && targetAdventureId) {
    const d = data as EncounterData;
    const rows = await db.select({ id: encountersTable.id }).from(encountersTable)
      .where(and(eq(encountersTable.adventureId, targetAdventureId), eq(encountersTable.name, d.encounter.name)));
    if (rows.length === 0) return [];
    return [{ id: `encounter:${d.encounter.name}`, type: 'encounter', name: d.encounter.name, existingId: rows[0].id, suggestedNewName: `${d.encounter.name} (imported)` }];
  }

  return [];
}

export async function applyImport(
  db: AppDb,
  storage: StorageAdapter,
  buffer: Uint8Array,
  resolutions: Resolutions,
  targetAdventureId?: number,
): Promise<{ type: ExportType; id: number; adventureId?: number }> {
  const { manifest, data, files } = parseZip(buffer);

  if (manifest.type === 'adventure') {
    const id = await applyAdventureImport(db, storage, data as AdventureData, files, resolutions);
    return { type: 'adventure', id };
  }
  if (manifest.type === 'playlist' && targetAdventureId) {
    const id = await applyPlaylistImport(db, storage, data as PlaylistData, files, resolutions, targetAdventureId);
    return { type: 'playlist', id, adventureId: targetAdventureId };
  }
  if (manifest.type === 'encounter' && targetAdventureId) {
    const id = await applyEncounterImport(db, data as EncounterData, resolutions, targetAdventureId);
    return { type: 'encounter', id, adventureId: targetAdventureId };
  }
  throw new Error('Invalid import type or missing targetAdventureId');
}

async function applyAdventureImport(
  db: AppDb, storage: StorageAdapter,
  d: AdventureData, files: Map<string, Uint8Array>, resolutions: Resolutions,
): Promise<number> {
  const conflictId = `adventure:${d.adventure.name}`;
  const res = resolutions[conflictId];
  let name = d.adventure.name;

  if (res?.action === 'skip') throw new Error('Import skipped');
  if (res?.action === 'replace') {
    const rows = await db.select({ id: adventuresTable.id }).from(adventuresTable).where(eq(adventuresTable.name, name));
    if (rows.length > 0) await db.delete(adventuresTable).where(eq(adventuresTable.id, rows[0].id));
  }
  if (res?.action === 'rename') name = res.newName ?? `${name} (imported)`;

  await storeFiles(storage, files);

  const [newAdventure] = await db.insert(adventuresTable).values({
    name, description: d.adventure.description, showHp: d.adventure.showHp, showInitiative: d.adventure.showInitiative,
  }).returning();

  for (const p of d.players) {
    await db.insert(playersTable).values({ ...p, adventureId: newAdventure.id });
  }
  for (const s of d.sessions) {
    await db.insert(sessionsTable).values({ ...s, adventureId: newAdventure.id });
  }

  const playlistIdMap = new Map<number, number>();
  for (const pl of d.playlists) {
    const [newPl] = await db.insert(playlistsTable).values({
      adventureId: newAdventure.id, name: pl.name, sortOrder: pl.sortOrder, playMode: pl.playMode, loop: pl.loop ?? false,
    }).returning();
    playlistIdMap.set(pl.localId, newPl.id);
    for (const t of pl.tracks) {
      await db.insert(tracksTable).values({ playlistId: newPl.id, name: t.name, type: t.type, url: t.url, sortOrder: t.sortOrder });
    }
  }

  for (const sc of d.imageScenes) {
    const [newSc] = await db.insert(imageScenesTable).values({ adventureId: newAdventure.id, name: sc.name, sortOrder: sc.sortOrder }).returning();
    for (const img of sc.images) {
      await db.insert(sceneImagesTable).values({
        sceneId: newSc.id,
        filePath: `/uploads/${img.fileKey}`,
        sortOrder: img.sortOrder,
        fit: img.fit,
        playlistId: img.playlistLocalId !== null ? (playlistIdMap.get(img.playlistLocalId) ?? null) : null,
      });
    }
  }

  for (const enc of d.encounters) {
    const [newEnc] = await db.insert(encountersTable).values({
      adventureId: newAdventure.id, name: enc.name, description: enc.description,
      playlistId: enc.playlistLocalId !== null ? (playlistIdMap.get(enc.playlistLocalId) ?? null) : null,
    }).returning();
    await importCombatants(db, newEnc.id, enc.combatants);
  }

  return newAdventure.id;
}

async function applyPlaylistImport(
  db: AppDb, storage: StorageAdapter,
  d: PlaylistData, files: Map<string, Uint8Array>, resolutions: Resolutions, adventureId: number,
): Promise<number> {
  const conflictId = `playlist:${d.playlist.name}`;
  const res = resolutions[conflictId];
  let name = d.playlist.name;

  if (res?.action === 'skip') throw new Error('Import skipped');
  if (res?.action === 'replace') {
    const rows = await db.select({ id: playlistsTable.id }).from(playlistsTable)
      .where(and(eq(playlistsTable.adventureId, adventureId), eq(playlistsTable.name, name)));
    if (rows.length > 0) await db.delete(playlistsTable).where(eq(playlistsTable.id, rows[0].id));
  }
  if (res?.action === 'rename') name = res.newName ?? `${name} (imported)`;

  await storeFiles(storage, files);

  const [newPl] = await db.insert(playlistsTable).values({
    adventureId, name, sortOrder: d.playlist.sortOrder, playMode: d.playlist.playMode, loop: d.playlist.loop ?? false,
  }).returning();

  for (const t of d.tracks) {
    await db.insert(tracksTable).values({ playlistId: newPl.id, name: t.name, type: t.type, url: t.url, sortOrder: t.sortOrder });
  }

  return newPl.id;
}

async function applyEncounterImport(
  db: AppDb, d: EncounterData, resolutions: Resolutions, adventureId: number,
): Promise<number> {
  const conflictId = `encounter:${d.encounter.name}`;
  const res = resolutions[conflictId];
  let name = d.encounter.name;

  if (res?.action === 'skip') throw new Error('Import skipped');
  if (res?.action === 'replace') {
    const rows = await db.select({ id: encountersTable.id }).from(encountersTable)
      .where(and(eq(encountersTable.adventureId, adventureId), eq(encountersTable.name, name)));
    if (rows.length > 0) await db.delete(encountersTable).where(eq(encountersTable.id, rows[0].id));
  }
  if (res?.action === 'rename') name = res.newName ?? `${name} (imported)`;

  const [newEnc] = await db.insert(encountersTable).values({ adventureId, name, description: d.encounter.description }).returning();
  await importCombatants(db, newEnc.id, d.combatants);
  return newEnc.id;
}

async function importCombatants(db: AppDb, encounterId: number, combatants: CombatantItem[]) {
  for (const c of combatants) {
    const [newC] = await db.insert(combatantsTable).values({
      encounterId, name: c.name, maxHp: c.maxHp, initiativeModifier: c.initiativeModifier,
      type: c.type as 'pc' | 'npc' | 'enemy' | 'group' | 'event' | 'lair',
      color: c.color, description: c.description, visibleToPlayers: c.visibleToPlayers, statBlock: c.statBlock,
    }).returning();
    if (c.type === 'group' && c.groupMembers.length > 0) {
      await db.insert(groupMembersTable).values(c.groupMembers.map((m) => ({ combatantId: newC.id, label: m.label, maxHp: m.maxHp })));
    }
  }
}
