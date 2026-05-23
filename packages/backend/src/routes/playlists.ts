import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { playlists, playlistTracks } from '../db/schema.js';

const router = new Hono();

const UPLOADS_DIR = process.env.UPLOADS_BASE_DIR ?? join(process.cwd(), 'uploads');

// ── Playlists ─────────────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const adventureId = c.req.query('adventureId');
  if (!adventureId) return c.json({ error: 'adventureId required' }, 400);
  const rows = await db.select().from(playlists).where(eq(playlists.adventureId, Number(adventureId))).orderBy(playlists.sortOrder);
  const withTracks = await Promise.all(
    rows.map(async (pl) => ({
      ...pl,
      tracks: await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, pl.id)).orderBy(playlistTracks.sortOrder),
    }))
  );
  return c.json(withTracks);
});

const playlistSchema = z.object({
  adventureId: z.number().int(),
  name: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
});

router.post('/', zValidator('json', playlistSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(playlists).values(data).returning();
  return c.json({ ...created, tracks: [] }, 201);
});

router.put('/:id', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const id = Number(c.req.param('id'));
  const { name } = c.req.valid('json');
  const [updated] = await db.update(playlists).set({ name }).where(eq(playlists.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(playlists).where(eq(playlists.id, id));
  return c.body(null, 204);
});

// ── Tracks ────────────────────────────────────────────────────────────────────

const trackSchema = z.object({
  playlistId: z.number().int(),
  name: z.string().min(1),
  type: z.enum(['file', 'youtube']),
  url: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
});

router.post('/tracks', zValidator('json', trackSchema), async (c) => {
  const data = c.req.valid('json');
  const [created] = await db.insert(playlistTracks).values(data).returning();
  return c.json(created, 201);
});

router.put('/tracks/:id', zValidator('json', trackSchema.partial().omit({ playlistId: true })), async (c) => {
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(playlistTracks).set(data).where(eq(playlistTracks.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/tracks/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(playlistTracks).where(eq(playlistTracks.id, id));
  return c.body(null, 204);
});

// ── Audio file upload ─────────────────────────────────────────────────────────

router.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  if (!['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'webm'].includes(ext)) {
    return c.json({ error: 'Unsupported audio file type' }, 400);
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  await writeFile(join(UPLOADS_DIR, filename), Buffer.from(buffer));

  return c.json({ url: `/uploads/${filename}`, name: file.name.replace(/\.[^.]+$/, '') }, 201);
});

export default router;
