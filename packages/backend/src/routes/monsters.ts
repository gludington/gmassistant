import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { AppVariables } from '../types.js';
import { monsters, monsterFolders } from '../db/schema.js';
import { mapFoundryActorToMonster, type FoundryRawActor } from '../lib/foundryImport.js';
import type { AppDb } from '../db/types.js';

const router = new Hono<{ Variables: AppVariables }>();

router.get('/', async (c) => {
  const db = c.var.db;
  const rows = await db.select().from(monsters).orderBy(monsters.name);
  return c.json(rows);
});

const monsterSchema = z.object({
  name: z.string().min(1),
  maxHp: z.number().int().min(0),
  initiativeModifier: z.number().int().default(0),
  statBlock: z.string().optional().nullable(),
  origin: z.string().optional(),
});

router.post('/', zValidator('json', monsterSchema), async (c) => {
  const db = c.var.db;
  const data = c.req.valid('json');
  const [created] = await db.insert(monsters).values({
    name: data.name,
    maxHp: data.maxHp,
    initiativeModifier: data.initiativeModifier,
    statBlock: data.statBlock ?? null,
    origin: data.origin ?? 'manual',
  }).returning();
  return c.json(created, 201);
});

router.put('/:id', zValidator('json', monsterSchema.partial()), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.maxHp !== undefined) updates.maxHp = data.maxHp;
  if (data.initiativeModifier !== undefined) updates.initiativeModifier = data.initiativeModifier;
  if (data.statBlock !== undefined) updates.statBlock = data.statBlock ?? null;
  if (data.origin !== undefined) updates.origin = data.origin;
  const [updated] = await db.update(monsters).set(updates).where(eq(monsters.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  await db.delete(monsters).where(eq(monsters.id, id));
  return c.body(null, 204);
});

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function upsertMonster(db: AppDb, values: typeof monsters.$inferInsert): Promise<'imported' | 'updated'> {
  const existing = await db.select({ id: monsters.id }).from(monsters)
    .where(sql`lower(${monsters.name}) = lower(${values.name})`);
  if (existing[0]) {
    await db.update(monsters).set(values).where(eq(monsters.id, existing[0].id));
    return 'updated';
  }
  await db.insert(monsters).values(values);
  return 'imported';
}

async function resolveFolderId(db: AppDb, path: string[] | null, cache: Map<string, number>): Promise<number | null> {
  if (!path || path.length === 0) return null;
  let parentId: number | null = null;
  let cacheKey = '';
  for (const segment of path) {
    cacheKey += `/${segment}`;
    const cached = cache.get(cacheKey);
    if (cached != null) {
      parentId = cached;
      continue;
    }
    const existing = await db.select({ id: monsterFolders.id }).from(monsterFolders)
      .where(and(eq(monsterFolders.name, segment), parentId === null ? isNull(monsterFolders.parentId) : eq(monsterFolders.parentId, parentId)));
    let id: number;
    if (existing[0]) {
      id = existing[0].id;
    } else {
      const [created] = await db.insert(monsterFolders).values({ name: segment, parentId }).returning({ id: monsterFolders.id });
      id = created.id;
    }
    cache.set(cacheKey, id);
    parentId = id;
  }
  return parentId;
}

const bulkImportSchema = z.object({
  origin: z.string().min(1), // provenance tag stamped onto every imported/updated monster, e.g. "foundry"
  monsters: z.array(z.object({
    name: z.string().min(1),
    source: z.string().optional(), // Foundry compendium/folder path for this actor — used only to place it in a library folder, not stored as-is
    system: z.record(z.string(), z.unknown()).default({}),
    items: z.array(z.object({
      name: z.string(),
      type: z.string(),
      system: z.record(z.string(), z.unknown()),
    })).optional(),
  })),
});

router.post('/bulk', zValidator('json', bulkImportSchema), async (c) => {
  const db = c.var.db;
  const { monsters: raw, origin } = c.req.valid('json');
  const folderCache = new Map<string, number>();

  let imported = 0;
  let updated = 0;

  for (const item of raw as FoundryRawActor[]) {
    const mapped = mapFoundryActorToMonster(item);
    const folderId = await resolveFolderId(db, mapped.folderPath, folderCache);

    const result = await upsertMonster(db, {
      name: mapped.name,
      maxHp: mapped.maxHp,
      initiativeModifier: mapped.initiativeModifier,
      statBlock: mapped.statBlock,
      cr: mapped.cr,
      creatureType: mapped.creatureType,
      folderId,
      origin,
    });
    if (result === 'imported') imported++; else updated++;
  }

  return c.json({ imported, updated, total: raw.length });
});

// ── Library export / import (move a whole library between instances) ─────────

router.get('/export', async (c) => {
  const db = c.var.db;
  const allMonsters = await db.select().from(monsters).orderBy(monsters.name);
  const allFolders = await db.select().from(monsterFolders);
  const folderById = new Map(allFolders.map((f) => [f.id, f]));

  function pathFor(folderId: number | null): string[] | null {
    if (folderId == null) return null;
    const parts: string[] = [];
    let current = folderById.get(folderId);
    while (current) {
      parts.unshift(current.name);
      current = current.parentId != null ? folderById.get(current.parentId) : undefined;
    }
    return parts.length ? parts : null;
  }

  const exportedMonsters = allMonsters.map((m) => ({
    name: m.name,
    maxHp: m.maxHp,
    initiativeModifier: m.initiativeModifier,
    statBlock: m.statBlock,
    cr: m.cr,
    creatureType: m.creatureType,
    tags: m.tags,
    origin: m.origin,
    folderPath: pathFor(m.folderId),
  }));

  return c.json({ monsters: exportedMonsters });
});

const libraryImportSchema = z.object({
  monsters: z.array(z.object({
    name: z.string().min(1),
    maxHp: z.number().int().min(0),
    initiativeModifier: z.number().int().default(0),
    statBlock: z.string().optional().nullable(),
    cr: z.number().optional().nullable(),
    creatureType: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().nullable(),
    origin: z.string().optional().nullable(),
    folderPath: z.array(z.string()).optional().nullable(),
  })),
});

router.post('/import', zValidator('json', libraryImportSchema), async (c) => {
  const db = c.var.db;
  const { monsters: raw } = c.req.valid('json');
  const folderCache = new Map<string, number>();

  let imported = 0;
  let updated = 0;

  for (const item of raw) {
    const folderId = await resolveFolderId(db, item.folderPath ?? null, folderCache);
    const result = await upsertMonster(db, {
      name: item.name,
      maxHp: item.maxHp,
      initiativeModifier: item.initiativeModifier ?? 0,
      statBlock: item.statBlock ?? null,
      cr: item.cr ?? null,
      creatureType: item.creatureType ?? null,
      tags: item.tags ?? null,
      origin: item.origin ?? 'manual',
      folderId,
    });
    if (result === 'imported') imported++; else updated++;
  }

  return c.json({ imported, updated, total: raw.length });
});

export default router;
