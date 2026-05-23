import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import type { AppVariables } from '../types.js';
import { encounters, combatants, adventures, adventurePlayers, groupMembers } from '../db/schema.js';

const router = new Hono<{ Variables: AppVariables }>();

router.get('/', async (c) => {
  const db = c.var.db;
  const adventureId = c.req.query('adventureId');
  const rows = adventureId
    ? await db.select().from(encounters).where(eq(encounters.adventureId, Number(adventureId)))
    : await db.select().from(encounters);
  return c.json(rows);
});

router.get('/:id', async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const [encounter] = await db.select().from(encounters).where(eq(encounters.id, id));
  if (!encounter) return c.json({ error: 'Not found' }, 404);
  const [adventure] = await db.select({ showHp: adventures.showHp, showInitiative: adventures.showInitiative }).from(adventures).where(eq(adventures.id, encounter.adventureId));
  const combatantList = await db.select().from(combatants).where(eq(combatants.encounterId, id));
  const players = await db.select().from(adventurePlayers).where(eq(adventurePlayers.adventureId, encounter.adventureId));

  const groupIds = combatantList.filter((x) => x.type === 'group').map((x) => x.id);
  const memberRows = groupIds.length > 0
    ? await db.select().from(groupMembers).where(inArray(groupMembers.combatantId, groupIds))
    : [];

  const combatantListWithMembers = combatantList.map((x) =>
    x.type === 'group'
      ? { ...x, members: memberRows.filter((m) => m.combatantId === x.id) }
      : x
  );

  const playerCombatants = players.map((p) => ({
    id: -p.id,
    encounterId: id,
    name: p.name,
    maxHp: p.maxHp,
    initiativeModifier: p.initiativeModifier,
    type: 'pc' as const,
    color: p.color,
    armorClass: p.armorClass,
    spellDc: p.spellDc,
    passivePerception: p.passivePerception,
    isAdventurePlayer: true,
  }));
  return c.json({ ...encounter, showHp: adventure?.showHp ?? false, showInitiative: adventure?.showInitiative ?? false, combatants: [...playerCombatants, ...combatantListWithMembers], playlistId: encounter.playlistId ?? null });
});

const encounterSchema = z.object({
  adventureId: z.number().int(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

router.post('/', zValidator('json', encounterSchema), async (c) => {
  const db = c.var.db;
  const data = c.req.valid('json');
  const [created] = await db.insert(encounters).values({
    adventureId: data.adventureId,
    name: data.name,
    description: data.description ?? null,
  }).returning();
  return c.json(created, 201);
});

router.put('/:id', zValidator('json', encounterSchema.partial().omit({ adventureId: true })), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(encounters)
    .set({ name: data.name, description: data.description ?? null })
    .where(eq(encounters.id, id))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.patch('/:id', zValidator('json', z.object({ playlistId: z.number().int().nullable() })), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const { playlistId } = c.req.valid('json');
  const [updated] = await db.update(encounters).set({ playlistId }).where(eq(encounters.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  await db.delete(encounters).where(eq(encounters.id, id));
  return c.body(null, 204);
});

// ── Combatants ───────────────────────────────────────────────────────────────

const combatantSchema = z.object({
  encounterId: z.number().int(),
  name: z.string().min(1),
  maxHp: z.number().int().min(0),
  initiativeModifier: z.number().int().default(0),
  type: z.enum(['pc', 'npc', 'enemy', 'group', 'event', 'lair']).default('enemy'),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  visibleToPlayers: z.boolean().optional().default(true),
  statBlock: z.string().optional().nullable(),
  members: z.array(z.object({ label: z.string().min(1), maxHp: z.number().int().min(1) })).optional(),
});

router.post('/combatants', zValidator('json', combatantSchema), async (c) => {
  const db = c.var.db;
  const data = c.req.valid('json');

  let computedMaxHp = data.maxHp;
  if (data.type === 'group' && data.members && data.members.length > 0) {
    computedMaxHp = data.members.reduce((sum, m) => sum + m.maxHp, 0);
  }

  const [created] = await db.insert(combatants).values({
    encounterId: data.encounterId,
    name: data.name,
    maxHp: computedMaxHp,
    initiativeModifier: data.initiativeModifier,
    type: data.type,
    color: data.color ?? null,
    description: data.description ?? null,
    visibleToPlayers: data.visibleToPlayers ?? true,
    statBlock: data.statBlock ?? null,
  }).returning();

  if (data.type === 'group' && data.members && data.members.length > 0) {
    await db.insert(groupMembers).values(
      data.members.map((m) => ({ combatantId: created.id, label: m.label, maxHp: m.maxHp }))
    );
    const members = await db.select().from(groupMembers).where(eq(groupMembers.combatantId, created.id));
    return c.json({ ...created, members }, 201);
  }

  return c.json(created, 201);
});

router.put('/combatants/:id', zValidator('json', combatantSchema.partial().omit({ encounterId: true })), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const { members, ...fields } = data;
  const [updated] = await db.update(combatants)
    .set({ ...fields, color: fields.color ?? null, description: fields.description ?? null, visibleToPlayers: fields.visibleToPlayers ?? true, statBlock: fields.statBlock ?? null })
    .where(eq(combatants.id, id))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);

  if (updated.type === 'group' && members && members.length > 0) {
    await db.delete(groupMembers).where(eq(groupMembers.combatantId, id));
    await db.insert(groupMembers).values(members.map((m) => ({ combatantId: id, label: m.label, maxHp: m.maxHp })));
    const updatedMembers = await db.select().from(groupMembers).where(eq(groupMembers.combatantId, id));
    return c.json({ ...updated, members: updatedMembers });
  }

  return c.json(updated);
});

router.delete('/combatants/:id', async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  await db.delete(combatants).where(eq(combatants.id, id));
  return c.body(null, 204);
});

// ── Group Members ─────────────────────────────────────────────────────────────

const groupMemberSchema = z.object({
  combatantId: z.number().int(),
  label: z.string().min(1),
  maxHp: z.number().int().min(1),
});

router.post('/combatants/group-members', zValidator('json', groupMemberSchema), async (c) => {
  const db = c.var.db;
  const data = c.req.valid('json');
  const [created] = await db.insert(groupMembers).values(data).returning();
  return c.json(created, 201);
});

router.put('/combatants/group-members/:id', zValidator('json', groupMemberSchema.partial()), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(groupMembers).set(data).where(eq(groupMembers.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/combatants/group-members/:id', async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  await db.delete(groupMembers).where(eq(groupMembers.id, id));
  return c.body(null, 204);
});

export default router;
