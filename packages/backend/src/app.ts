import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppDb } from './db/types.js';
import type { StorageAdapter } from './storage/types.js';
import type { AppVariables } from './types.js';
import adventures from './routes/adventures.js';
import encounters from './routes/encounters.js';
import sessions from './routes/sessions.js';
import uploads from './routes/uploads.js';
import playlistsRouter from './routes/playlists.js';
import monstersRouter from './routes/monsters.js';
import portability from './routes/portability.js';

export function createApp(db: AppDb, storage: StorageAdapter) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use('/api/*', cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));

  app.use('*', (c, next) => {
    c.set('db', db);
    c.set('storage', storage);
    return next();
  });

  app.route('/api/adventures', adventures);
  app.route('/api/encounters', encounters);
  app.route('/api/sessions', sessions);
  app.route('/api/uploads', uploads);
  app.route('/api/playlists', playlistsRouter);
  app.route('/api/monsters', monstersRouter);
  app.route('/api', portability);

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/uploads/:key{.+}', async (c) => {
    const key = c.req.param('key');
    const result = await c.var.storage.get(key);
    if (!result) return c.notFound();
    return new Response(result.body, {
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  });

  return app;
}
