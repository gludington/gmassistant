import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
});

export const encounters = sqliteTable('encounters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adventureId: integer('adventure_id')
    .notNull()
    .references(() => adventures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  playlistId: integer('playlist_id').references(() => playlists.id, { onDelete: 'set null' }),
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
  initiativeModifier: integer('initiative_modifier').notNull().default(0),
  color: text('color'),
  armorClass: integer('armor_class'),
  spellDc: integer('spell_dc'),
  passivePerception: integer('passive_perception'),
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
