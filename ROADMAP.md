# gmassisstant Roadmap

## Cloudflare Deployment

The goal is to deploy the full stack to Cloudflare:
- **Frontend** → Cloudflare Pages (static SPA)
- **Backend** → Cloudflare Workers (Hono app)
- **Database** → Cloudflare D1 (SQLite-compatible, managed)
- **File storage** → Cloudflare R2 (object storage, S3-compatible)

The frontend and Worker will be deployed together as a single Pages project using the `_worker.js` pattern, so `/api/*` requests are handled by the Worker and everything else is served as static assets — no CORS configuration required, no separate domain for the API.

---

### Cloudflare Account Prerequisites

#### 1. Account

Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) if you don't have one. The free tier covers this project comfortably:
- Workers: 100,000 requests/day free
- Pages: unlimited sites, 500 builds/month free
- D1: 5 million row reads/day, 100,000 writes/day free
- R2: 10 GB storage, 1 million Class A ops/month free

#### 2. Wrangler CLI

Install the Wrangler CLI locally:

```bash
pnpm add -g wrangler
```

Authenticate it to your account:

```bash
wrangler login
```

This opens a browser OAuth flow. Your credentials are stored in `~/.wrangler/config/default.toml`.

#### 3. Create a D1 Database

Run once to provision the database in your Cloudflare account:

```bash
wrangler d1 create gmassistant-db
```

Wrangler prints a binding block — copy the `database_id` value, you'll need it in `wrangler.toml`:

```
✅ Successfully created DB 'gmassistant-db'

[[d1_databases]]
binding = "DB"
database_name = "gmassistant-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Apply the schema to the remote database:

```bash
wrangler d1 execute gmassistant-db --remote --file=packages/backend/drizzle/0000_puzzling_madelyne_pryor.sql
```

For local development against a local D1 (instead of the real SQLite file):

```bash
wrangler d1 execute gmassistant-db --local --file=packages/backend/drizzle/0000_puzzling_madelyne_pryor.sql
```

#### 4. Create an R2 Bucket

Run once to provision the bucket:

```bash
wrangler r2 bucket create gmassistant-uploads
```

R2 objects are private by default. To serve uploaded images publicly (scene images shown to players), either:

- **Option A (simpler):** Add a public access domain to the bucket in the Cloudflare dashboard (R2 → bucket → Settings → Public Access). This gives a `pub-xxxx.r2.dev` URL or a custom domain.
- **Option B:** Serve images through the Worker via a `/uploads/:key` route that streams from R2 — no public bucket needed, but adds Worker CPU time per image.

Option A is recommended for scene images since they can be large and are read-only after upload.

#### 5. Create a Cloudflare Pages Project

Either via the dashboard or CLI. If connecting to the GitHub repo (recommended):

1. Go to **Pages → Create a project → Connect to Git**
2. Select the `gmassistant` repository
3. Set the build configuration:
   - **Framework preset:** None
   - **Build command:** `pnpm run build` (at repo root — needs a root `build` script that builds both packages)
   - **Build output directory:** `packages/frontend/dist`
4. Set environment variables for the build (see below)

Alternatively, deploy manually with:

```bash
wrangler pages deploy packages/frontend/dist --project-name=gmassistant
```

---

### Code Changes Required

#### 1. Split the backend entry point

`packages/backend/src/index.ts` currently mixes the Hono app with the Node.js server adapter. Split into:

- **`src/app.ts`** — defines and exports the Hono app with all routes mounted; no Node imports
- **`src/index.ts`** — imports `app` from `app.ts`, calls `serve(app, ...)` from `@hono/node-server` for local dev
- **`src/worker.ts`** — exports `export default app` for the Cloudflare Worker entrypoint

The static file serving (`serveStatic` from `@hono/node-server/serve-static`) lives only in `index.ts` and is replaced by R2 in the Worker path.

#### 2. Database factory for D1

`packages/backend/src/db/index.ts` currently exports a module-level singleton using the LibSQL file driver:

```ts
const client = createClient({ url: 'file:./gmassisstant.db' });
export const db = drizzle(client, { schema });
```

This won't work in Workers because:
- `@libsql/client` uses Node.js internals
- The D1 binding is per-request (lives on `c.env.DB`), not available at module init time

Replace with a factory:

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
```

For local dev, keep a separate `src/db/local.ts` that uses LibSQL:

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

const client = createClient({ url: 'file:./gmassisstant.db' });
export const db = drizzle(client, { schema });
```

In route handlers, `getDb(c.env.DB)` replaces the current `db` import. A Hono middleware can attach it to context to avoid repeating the call in every handler:

```ts
app.use('*', async (c, next) => {
  c.set('db', getDb(c.env.DB));
  await next();
});
```

This is the most invasive change — every route file needs to call `c.get('db')` instead of importing `db`.

#### 3. Storage adapter for R2

`packages/backend/src/routes/uploads.ts` uses `node:fs/promises`, `node:path`, and `process.cwd()` directly. Replace with an adapter interface:

```ts
interface StorageAdapter {
  put(key: string, data: ArrayBuffer, contentType: string): Promise<string>; // returns public URL
}
```

Two implementations:
- **`LocalStorageAdapter`** — wraps `fs/promises`, returns `/uploads/:key`; used in dev via `index.ts`
- **`R2StorageAdapter`** — calls `env.BUCKET.put(key, data)`, returns the R2 public URL; used in the Worker

The route handler receives the adapter (injected via Hono context or constructor) and calls `adapter.put(...)` — no `fs` imports in the route itself.

#### 4. CORS

The hardcoded `origin: ['http://localhost:5173']` in `index.ts` needs to become:
- Dev: `localhost:5173` (stays in `index.ts`)
- Production: the Pages domain (e.g. `https://gmassistant.pages.dev`), set via env var

Since frontend and Worker are co-deployed on the same Pages domain, CORS can be omitted entirely for production — same-origin requests don't need it.

#### 5. `wrangler.toml`

Create at `packages/backend/wrangler.toml`:

```toml
name = "gmassistant-worker"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "gmassistant-db"
database_id = "YOUR_DATABASE_ID_HERE"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "gmassistant-uploads"

[site]
bucket = "../../packages/frontend/dist"
```

The `nodejs_compat` flag is needed if any indirect dependency still uses Node shims (e.g. `crypto`, `buffer`). It enables Cloudflare's Node.js compatibility layer.

#### 6. Worker types

Install Cloudflare Worker types so TypeScript knows about `D1Database`, `R2Bucket`, etc.:

```bash
pnpm add -D @cloudflare/workers-types --filter backend
```

Add to `packages/backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
```

#### 7. Root build script

Pages needs a single build command at the repo root. Add to the root `package.json`:

```json
{
  "scripts": {
    "build": "pnpm --filter types build && pnpm --filter frontend build"
  }
}
```

The Worker is bundled by Wrangler separately, not by the Pages build.

---

### Deployment Flow

#### First deploy (manual)

```bash
# 1. Build the frontend
pnpm --filter frontend build

# 2. Deploy Worker (from packages/backend)
cd packages/backend
wrangler deploy

# 3. Deploy Pages (from repo root)
wrangler pages deploy packages/frontend/dist --project-name=gmassistant
```

#### Subsequent deploys via GitHub Actions (optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter types build
      - run: pnpm --filter frontend build
      - name: Deploy Worker
        run: pnpm --filter backend wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - name: Deploy Pages
        run: npx wrangler pages deploy packages/frontend/dist --project-name=gmassistant
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Add `CLOUDFLARE_API_TOKEN` to the GitHub repo secrets. Generate the token at **Cloudflare dashboard → My Profile → API Tokens → Create Token → Edit Cloudflare Workers** template, scoped to your account.

---

### Schema Migrations After Initial Deploy

Since the project currently resets the DB in dev rather than running incremental migrations, a migration strategy needs to be established before the first production deploy:

- The initial schema (`0000_puzzling_madelyne_pryor.sql`) is applied once with `wrangler d1 execute --remote`
- Future schema changes need a new numbered SQL file and a `wrangler d1 execute --remote --file=...` step in the deploy workflow
- Drizzle Kit can generate these with `drizzle-kit generate` once migrations are no longer reset in dev

---

### Summary of Work

| Task | Files affected | Effort |
|---|---|---|
| Split entry point | `src/index.ts` → `src/app.ts` + `src/worker.ts` | Small |
| DB factory for D1 | `src/db/index.ts`, all route files | Medium |
| Storage adapter for R2 | `src/routes/uploads.ts` + new adapter files | Small |
| CORS env var | `src/index.ts` / `src/app.ts` | Trivial |
| `wrangler.toml` | New file | Small |
| Worker types | `tsconfig.json`, `package.json` | Trivial |
| Root build script | Root `package.json` | Trivial |
| Migration strategy | `drizzle/` | Small |
| CI/CD (optional) | `.github/workflows/deploy.yml` | Small |
