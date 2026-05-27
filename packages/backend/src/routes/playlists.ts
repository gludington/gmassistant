import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { AppVariables } from '../types.js';
import { playlists, playlistTracks } from '../db/schema.js';

const router = new Hono<{ Variables: AppVariables }>();

const AUDIO_EXTS = ['mp3', 'ogg', 'oga', 'wav', 'flac', 'm4a', 'aac', 'webm', 'mp4', 'opus', 'wma', 'aiff', 'aif'];
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
  flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm',
  mp4: 'audio/mp4', opus: 'audio/opus', wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff', aif: 'audio/aiff',
};

// ── Playlists ─────────────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const db = c.var.db;
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
  playMode: z.enum(['sequential', 'shuffle']).optional().default('sequential'),
});

router.post('/', zValidator('json', playlistSchema), async (c) => {
  const db = c.var.db;
  const data = c.req.valid('json');
  const [created] = await db.insert(playlists).values(data).returning();
  return c.json({ ...created, tracks: [] }, 201);
});

router.put('/:id', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const { name } = c.req.valid('json');
  const [updated] = await db.update(playlists).set({ name }).where(eq(playlists.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.patch('/:id', zValidator('json', z.object({ playMode: z.enum(['sequential', 'shuffle']).optional(), loop: z.boolean().optional() })), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const [updated] = await db.update(playlists).set({ ...body }).where(eq(playlists.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/:id', async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  await db.delete(playlists).where(eq(playlists.id, id));
  return c.body(null, 204);
});

// ── Tracks ────────────────────────────────────────────────────────────────────

const trackSchema = z.object({
  playlistId: z.number().int(),
  name: z.string().min(1),
  type: z.enum(['file', 'youtube', 'spotify']),
  url: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
});

router.post('/tracks', zValidator('json', trackSchema), async (c) => {
  const db = c.var.db;
  const data = c.req.valid('json');
  const [created] = await db.insert(playlistTracks).values(data).returning();
  return c.json(created, 201);
});

router.put('/tracks/:id', zValidator('json', trackSchema.partial().omit({ playlistId: true })), async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param('id'));
  const data = c.req.valid('json');
  const [updated] = await db.update(playlistTracks).set(data).where(eq(playlistTracks.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

router.delete('/tracks/:id', async (c) => {
  const db = c.var.db;
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
  if (!AUDIO_EXTS.includes(ext)) {
    return c.json({ error: `Unsupported audio file type: .${ext}` }, 400);
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  await c.var.storage.put(filename, buffer, AUDIO_MIME[ext] ?? 'audio/mpeg');

  return c.json({ url: `/uploads/${filename}`, name: file.name.replace(/\.[^.]+$/, '') }, 201);
});

export default router;
