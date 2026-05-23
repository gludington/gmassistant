# GM Assistant

A D&D tabletop session assistant for Game Masters. Manage adventures, encounters, playlists, and scenes from a DM interface while pushing a live initiative tracker and background images to a separate player-facing screen.

## Features

- **Adventure management** — create adventures with players, image scenes, encounters, and playlists
- **Encounter runner** — live initiative tracker with prev/next navigation, round counter, HP tracking, and condition management
- **Player screen** — separate full-screen view for a TV or monitor, synced in real time via BroadcastChannel
- **D&D 2024 conditions** — all 17 conditions including Bloodied (auto-applied at 50% HP)
- **Group combatants** — track groups of enemies with per-member HP and conditions
- **Image scenes** — upload images, push them to the player screen; drag to reorder within scenes
- **Playlists & audio** — create playlists of uploaded files (MP3, M4A, OGG, FLAC, WAV, MP4, Opus, and more) or YouTube tracks; shuffle/sequential modes; persist across navigation
- **Playlist continuity** — navigating to a scene or encounter whose playlist is already playing never restarts the music
- **AudioBar** — always-visible playback bar with progress strip (click to seek), track time, shuffle toggle, and an optional YouTube video panel
- **Open5e integration** — search the Open5e monster database and import directly into encounters
- **Help screen** — in-app reference for all features, accessible from every GM page
- **Desktop app** — Electron build with bundled server and SQLite database; no internet required except for YouTube playback

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5, TanStack Router v1, TanStack Query v5 |
| Backend | Hono v4, Drizzle ORM, LibSQL (SQLite) |
| Desktop | Electron 31, electron-builder |
| Cloudflare | Worker (API), Pages (frontend), D1 (database), R2 (uploads) |
| Monorepo | pnpm workspaces |
| Shared types | `@gmassisstant/types` |

## Project Structure

```
packages/
  backend/   — Hono API server + Drizzle schema (platform-agnostic)
  frontend/  — React SPA + Cloudflare Pages Functions proxy
  desktop/   — Electron wrapper
  worker/    — Cloudflare Worker entrypoint (D1 + R2)
  types/     — Shared TypeScript types
```

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm install
```

### Database setup

```bash
cd packages/backend
pnpm db:push
```

### Run

```bash
pnpm dev
```

This starts the backend (port 3000) and frontend dev server (port 5173) concurrently. The frontend proxies `/api` and `/uploads` to the backend.

### Routes

| Path | Description |
|------|-------------|
| `/` | Adventure list (DM home) |
| `/adventures/:id` | Adventure detail — players, scenes, encounters, playlists |
| `/run/:encounterId` | Live encounter runner (DM view) |
| `/player` | Player-facing screen — open in a separate window |
| `/help` | In-app help reference |

---

## Cloudflare Deployment

The app deploys as:

- **Cloudflare Pages** — serves the React SPA
- **Cloudflare Worker** (`gmassisstant-api`) — handles all API requests
- **Cloudflare D1** — SQLite database
- **Cloudflare R2** — file storage for uploaded images and audio

Pages routes `/api/*` requests to the Worker via a Service Binding (no public round-trip).

### Prerequisites

- A Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated:
  ```bash
  npx wrangler login
  ```

### First-time setup

#### 1. Create a local `wrangler.toml`

`packages/worker/wrangler.toml` is gitignored. Generate it from the committed example:

```bash
cp packages/worker/wrangler.toml.example packages/worker/wrangler.toml
```

Then fill in the three placeholders — values come from the next two steps.

#### 2. Create the D1 database

```bash
npx wrangler d1 create gmassisstant
```

Copy the `database_id` and `database_name` from the output into `wrangler.toml` (replacing `${CF_D1_DATABASE_ID}` and `${CF_D1_DATABASE_NAME}`).

#### 3. Create the R2 bucket

```bash
npx wrangler r2 bucket create gmassisstant-uploads
```

Set `${CF_R2_BUCKET_NAME}` to `gmassisstant-uploads` in `wrangler.toml`.

#### 4. Apply the database schema

```bash
cd packages/worker
npx wrangler d1 migrations apply gmassisstant
```

#### 5. Deploy the Worker

```bash
cd packages/worker
npx wrangler deploy
```

#### 6. Create the Pages project

Go to the [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project** → **Connect to Git**.

- Select your repository
- Set the build command: `pnpm --filter @gmassisstant/frontend build`
- Set the output directory: `packages/frontend/dist`
- Save and deploy

#### 7. Add the Service Binding

In the Pages project settings:

**Settings → Functions → Service Bindings → Add binding**

| Variable name | Service |
|---|---|
| `API` | `gmassisstant-api` |

This connects the Pages Function proxy to your Worker without a public network hop. Redeploy Pages after adding the binding.

#### 8. (Optional) Protect with Cloudflare Access

To restrict the app to specific users (recommended):

1. Go to **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. Set the domain to your Pages URL (e.g. `gmassisstant.pages.dev`)
3. Under **Authentication**, add your identity providers:
   - **Google**: create an OAuth 2.0 web app at [console.cloud.google.com](https://console.cloud.google.com); set the redirect URI to `https://<your-team>.cloudflareaccess.com/cdn-cgi/access/callback`
   - **Discord**: create an application at [discord.com/developers](https://discord.com/developers/applications); set the same redirect URI
4. Create a policy: **Allow** → **Emails** → your email address

### Continuous deployment (GitHub Actions)

The included workflow (`.github/workflows/deploy.yml`) deploys automatically on every push to `main`.

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret | Where to find it |
|---|---|
| `CF_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens → Create token (use the "Edit Cloudflare Workers" template, also add Pages and D1 permissions) |
| `CF_ACCOUNT_ID` | Cloudflare Dashboard → right sidebar on the Workers & Pages overview page |
| `CF_D1_DATABASE_NAME` | The name you gave to `wrangler d1 create` (e.g. `gmassisstant`) |
| `CF_D1_DATABASE_ID` | Shown after `wrangler d1 create`, or via `wrangler d1 list` |
| `CF_R2_BUCKET_NAME` | The name you gave to `wrangler r2 bucket create` (e.g. `gmassisstant-uploads`) |

### Local Worker development

You can run the Worker locally against a local D1 and R2 simulation:

```bash
# Generate wrangler.toml first (if you haven't already)
cp packages/worker/wrangler.toml.example packages/worker/wrangler.toml
# Then fill in the placeholder values

# Apply schema to the local D1 instance
cd packages/worker && npx wrangler d1 migrations apply gmassisstant --local

# Start the Worker dev server (rebuilds backend automatically on changes)
cd packages/worker && npx wrangler dev
```

The Worker listens on `http://localhost:8787` by default.

---

## Desktop App

The packaged Electron app runs its own local Hono server and SQLite database — no installation beyond the app itself is required. Your data is stored in your OS user-data folder and persists across updates.

### Build

```bash
# All platforms (requires matching runners for macOS/Windows)
pnpm desktop:build

# Platform-specific
pnpm desktop:build:linux
pnpm desktop:build:win
pnpm desktop:build:mac
```

Download the latest installer from the releases page and run it over the existing installation to update.

---

## Player Screen

Open the player screen from any GM page ("Open Player Screen" button). Move it to your TV or secondary monitor. The DM view syncs to it via the BroadcastChannel API and localStorage, so it also works correctly on reload.
