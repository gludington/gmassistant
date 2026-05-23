import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import adventures from './routes/adventures.js';
import encounters from './routes/encounters.js';
import sessions from './routes/sessions.js';
import uploads from './routes/uploads.js';
import playlistsRouter from './routes/playlists.js';

export const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

const uploadsRoot = process.env.UPLOADS_BASE_DIR ? dirname(process.env.UPLOADS_BASE_DIR) + '/' : './';
app.use('/uploads/*', serveStatic({ root: uploadsRoot }));

app.route('/api/adventures', adventures);
app.route('/api/encounters', encounters);
app.route('/api/sessions', sessions);
app.route('/api/uploads', uploads);
app.route('/api/playlists', playlistsRouter);

app.get('/health', (c) => c.json({ ok: true }));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}
