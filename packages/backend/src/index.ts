import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createLibsqlDb } from './db/index.js';
import { LocalStorage } from './storage/local.js';
import { createApp } from './app.js';

const UPLOADS_DIR = process.env.UPLOADS_BASE_DIR ?? join(process.cwd(), 'uploads');
const db = createLibsqlDb();

// Always run migrations on startup so the schema is never behind.
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
await migrate(db, { migrationsFolder });

const storage = new LocalStorage(UPLOADS_DIR);
const app = createApp(db, storage);

// Desktop app: serve the pre-built frontend so all requests share one HTTP origin
const frontendDir = process.env.ELECTRON_FRONTEND_DIR;
if (frontendDir) {
  const uploadsRoot = process.env.UPLOADS_BASE_DIR ? dirname(process.env.UPLOADS_BASE_DIR) + '/' : './';
  app.use('/uploads/*', serveStatic({ root: uploadsRoot }));
  app.use('/*', serveStatic({ root: frontendDir }));
  app.get('*', async (c) => {
    const html = await readFile(join(frontendDir, 'index.html'), 'utf-8');
    return c.html(html);
  });
}

export { app };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}
