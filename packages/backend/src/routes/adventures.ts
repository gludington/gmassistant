import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adventures, imageScenes, sceneImages, encounters, combatants, adventurePlayers, groupMembers } from '../db/schema.js';

const router = new Hono();

router.get('/', async (c) => {
  const all = await db.select().from(adventures).orderBy(adventures.name);
  return c.json(all);
});

router.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [adventure] = await db.select().from(adventures).where(eq(adventures.id, id));
  if (!adventure) return c.json({ error: 'Not found' }, 404);

  const scenes = await db.select().from(imageScenes).where(eq(imageScenes.adventureId, id)).orderBy(imageScenes.sortOrder);
  const scenesWithImages = await Promise.all(
    scenes.map(async (scene) => ({
      ...scene,
      images: await db.select().from(sceneImages).where(eq(sceneImages.sceneId, scene.id)).orderBy(sceneImages.sortOrder),
    }))
  );

  const encounterList = await db.select().from(encounters).where(eq(encounters.adventureId, id));
  const encountersWithCombatants = await Promise.all(
    encounterList.map(async (encounter) => {
      const combatantList = await db.select().from(combatants).where(eq(combatants.encounterId, encounter.id));
      const groupIds = combatantList.filter((c) => c.type === 'group').map((c) => c.id);
      const memberRows = groupIds.length > 0
        ? await db.select().from(groupMembers).where(inArray(groupMembers.combatantId, groupIds))
        : [];
      return {
        ...encounter,
        combatants: combatantList.map((c) =>
          c.type === 'group'
            ? { ...c, members: memberRows.filter((m) => m.combatantId === c.id) }
            : c
        ),
      };
    })
  );

  const players = await db.select().from(adventurePlayers).where(eq(adventurePlayers.adventureId, id));

  return c.json({ ...adventure, imageScenes: scenesWithImages, encounters: encountersWithCombatants, players });
});

const adventureSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  showHp: z.boolean().optional().default(false),
  showInitiative: z.boolean().optional().default(false),
});

router.post('/', zValidator('json', adventureSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(adventures).values({
    name: data.name,
    description: data.description ?? null,
    showHp: data.showHp ?? false,
    showInitiative: data.showInitiative ?? false,
  }).returning();
  return c.json(created, 201);
});

router.put('/:id', zValidator('json', adventureSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(adventures)
    .set({ name: data.name, description: data.description ?? null, showHp: data.showHp ?? false, showInitiative: data.showInitiative ?? false, updatedAt: new Date().toISOString() })
    .where(eq(adventures.id, id))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.patch('/:id', zValidator('json', adventureSchema.partial()), async (c) => {
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(adventures)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(adventures.id, id))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(adventures).where(eq(adventures.id, id));
  return c.body(null, 204);
});

// ── Image Scenes ─────────────────────────────────────────────────────────────

const sceneSchema = z.object({
  adventureId: z.number().int(),
  name: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
});

router.post('/scenes', zValidator('json', sceneSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(imageScenes).values(data).returning();
  return c.json(created, 201);
});

router.delete('/scenes/:sceneId', async (c) => {
  const sceneId = Number(c.req.param('sceneId'));
  await db.delete(imageScenes).where(eq(imageScenes.id, sceneId));
  return c.body(null, 204);
});

const sceneImageSchema = z.object({
  sceneId: z.number().int(),
  filePath: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
  fit: z.enum(['cover', 'fit', 'center']).optional().default('fit'),
});

router.post('/scenes/images', zValidator('json', sceneImageSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(sceneImages).values(data).returning();
  return c.json(created, 201);
});

router.put('/scenes/images/:imageId', zValidator('json', z.object({ sortOrder: z.number().int() })), async (c) => {
  const imageId = Number(c.req.param('imageId'));
  const { sortOrder } = c.req.valid('json');
  const [updated] = await db.update(sceneImages).set({ sortOrder }).where(eq(sceneImages.id, imageId)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.patch('/scenes/images/:imageId', zValidator('json', z.object({ fit: z.enum(['cover', 'fit', 'center']) })), async (c) => {
  const imageId = Number(c.req.param('imageId'));
  const { fit } = c.req.valid('json');
  const [updated] = await db.update(sceneImages).set({ fit }).where(eq(sceneImages.id, imageId)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/scenes/images/:imageId', async (c) => {
  const imageId = Number(c.req.param('imageId'));
  await db.delete(sceneImages).where(eq(sceneImages.id, imageId));
  return c.body(null, 204);
});

// ── Adventure Players ─────────────────────────────────────────────────────────

const playerSchema = z.object({
  adventureId: z.number().int(),
  name: z.string().min(1),
  maxHp: z.number().int().min(1).default(10),
  initiativeModifier: z.number().int().default(0),
  color: z.string().optional().nullable(),
  armorClass: z.number().int().optional().nullable(),
  spellDc: z.number().int().optional().nullable(),
  passivePerception: z.number().int().optional().nullable(),
});

router.post('/players', zValidator('json', playerSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(adventurePlayers).values({
    ...data,
    color: data.color ?? null,
    armorClass: data.armorClass ?? null,
    spellDc: data.spellDc ?? null,
    passivePerception: data.passivePerception ?? null,
  }).returning();
  return c.json(created, 201);
});

router.put('/players/:id', zValidator('json', playerSchema.partial().omit({ adventureId: true })), async (c) => {
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(adventurePlayers)
    .set({ ...data, color: data.color ?? null, armorClass: data.armorClass ?? null, spellDc: data.spellDc ?? null, passivePerception: data.passivePerception ?? null })
    .where(eq(adventurePlayers.id, id))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/players/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(adventurePlayers).where(eq(adventurePlayers.id, id));
  return c.body(null, 204);
});

export default router;
