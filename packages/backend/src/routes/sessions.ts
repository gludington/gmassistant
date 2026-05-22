import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';

const router = new Hono();

router.get('/', async (c) => {
  const adventureId = c.req.query('adventureId');
  const rows = adventureId
    ? await db.select().from(sessions).where(eq(sessions.adventureId, Number(adventureId))).orderBy(sessions.date)
    : await db.select().from(sessions).orderBy(sessions.date);
  return c.json(rows);
});

router.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return c.json({ error: 'Not found' }, 404);
  return c.json(session);
});

const sessionSchema = z.object({
  adventureId: z.number().int(),
  name: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().optional().nullable(),
});

router.post('/', zValidator('json', sessionSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(sessions).values({
    ...data,
    notes: data.notes ?? null,
  }).returning();
  return c.json(created, 201);
});

router.put('/:id', zValidator('json', sessionSchema.partial().omit({ adventureId: true })), async (c) => {
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(sessions)
    .set({ ...data, notes: data.notes ?? null })
    .where(eq(sessions.id, id))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(sessions).where(eq(sessions.id, id));
  return c.body(null, 204);
});

export default router;
