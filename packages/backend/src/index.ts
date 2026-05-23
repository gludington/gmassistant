import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
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

// Desktop app: serve the pre-built frontend so all requests share one HTTP origin
const frontendDir = process.env.ELECTRON_FRONTEND_DIR;
if (frontendDir) {
  app.use('/*', serveStatic({ root: frontendDir }));
  app.get('*', async (c) => {
    const html = await readFile(join(frontendDir, 'index.html'), 'utf-8');
    return c.html(html);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}
