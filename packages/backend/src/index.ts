import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import adventures from './routes/adventures.js';
import encounters from './routes/encounters.js';
import sessions from './routes/sessions.js';
import uploads from './routes/uploads.js';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

app.use('/uploads/*', serveStatic({ root: './' }));

app.route('/api/adventures', adventures);
app.route('/api/encounters', encounters);
app.route('/api/sessions', sessions);
app.route('/api/uploads', uploads);

app.get('/health', (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
