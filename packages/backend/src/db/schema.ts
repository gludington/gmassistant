import { sqliteTable, text, integer, real, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const adventures = sqliteTable('adventures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  showHp: integer('show_hp', { mode: 'boolean' }).notNull().default(false),
  showInitiative: integer('show_initiative', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const playlists = sqliteTable('playlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adventureId: integer('adventure_id')
    .notNull()
    .references(() => adventures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  playMode: text('play_mode', { enum: ['sequential', 'shuffle'] }).notNull().default('sequential'),
  loop: integer('loop', { mode: 'boolean' }).notNull().default(false),
  volume: integer('volume').notNull().default(100),
});

export const playlistTracks = sqliteTable('playlist_tracks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playlistId: integer('playlist_id')
    .notNull()
    .references(() => playlists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['file', 'youtube'] }).notNull().default('file'),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  volume: integer('volume').notNull().default(100),
});

export const imageScenes = sqliteTable('image_scenes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adventureId: integer('adventure_id')
    .notNull()
    .references(() => adventures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const sceneImages = sqliteTable('scene_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sceneId: integer('scene_id')
    .notNull()
    .references(() => imageScenes.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  fit: text('fit', { enum: ['cover', 'fit', 'center'] }).notNull().default('fit'),
  playlistId: integer('playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
  stopPlaylist: integer('stop_playlist', { mode: 'boolean' }).notNull().default(false),
  ambientPlaylistId: integer('ambient_playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
  stopAmbient: integer('stop_ambient', { mode: 'boolean' }).notNull().default(false),
});

export const encounters = sqliteTable('encounters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adventureId: integer('adventure_id')
    .notNull()
    .references(() => adventures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  playlistId: integer('playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
  stopPlaylist: integer('stop_playlist', { mode: 'boolean' }).notNull().default(false),
  ambientPlaylistId: integer('ambient_playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
  stopAmbient: integer('stop_ambient', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const combatants = sqliteTable('combatants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  encounterId: integer('encounter_id')
    .notNull()
    .references(() => encounters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  maxHp: integer('max_hp').notNull(),
  initiativeModifier: integer('initiative_modifier').notNull().default(0),
  type: text('type', { enum: ['pc', 'npc', 'enemy', 'group', 'event', 'lair'] }).notNull().default('enemy'),
  color: text('color'),
  description: text('description'),
  visibleToPlayers: integer('visible_to_players', { mode: 'boolean' }).notNull().default(true),
  statBlock: text('stat_block'),
  inLair: integer('in_lair', { mode: 'boolean' }).notNull().default(false),
});

export const groupMembers = sqliteTable('group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  combatantId: integer('combatant_id')
    .notNull()
    .references(() => combatants.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  maxHp: integer('max_hp').notNull().default(10),
});

export const adventurePlayers = sqliteTable('adventure_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adventureId: integer('adventure_id')
    .notNull()
    .references(() => adventures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  maxHp: integer('max_hp').notNull().default(10),
  currentHp: integer('current_hp'),
  initiativeModifier: integer('initiative_modifier').notNull().default(0),
  color: text('color'),
  armorClass: integer('armor_class'),
  spellDc: integer('spell_dc'),
  passivePerception: integer('passive_perception'),
});

export const monsterFolders = sqliteTable('monster_folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  parentId: integer('parent_id').references((): AnySQLiteColumn => monsterFolders.id, { onDelete: 'cascade' }),
});

export const monsters = sqliteTable('monsters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  maxHp: integer('max_hp').notNull().default(0),
  initiativeModifier: integer('initiative_modifier').notNull().default(0),
  statBlock: text('stat_block'),
  cr: real('cr'),
  creatureType: text('creature_type'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  origin: text('origin'), // where this monster came from: 'manual', 'open5e', 'foundry', etc. ("source" was already in use for the Foundry compendium/folder path)
  folderId: integer('folder_id').references(() => monsterFolders.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adventureId: integer('adventure_id')
    .notNull()
    .references(() => adventures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
});
