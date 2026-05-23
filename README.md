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
| Monorepo | pnpm workspaces |
| Shared types | `@gmassisstant/types` |

## Project Structure

```
packages/
  backend/   — Hono API server + Drizzle schema
  frontend/  — React SPA
  desktop/   — Electron wrapper
  types/     — Shared TypeScript types
```

## Getting Started

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

### Run (development)

From the repo root:

```bash
pnpm dev
```

Or start each package separately:

```bash
# Terminal 1
cd packages/backend && pnpm dev

# Terminal 2
cd packages/frontend && pnpm dev
```

The frontend dev server proxies `/api` requests to the backend.

### Routes

| Path | Description |
|------|-------------|
| `/` | Adventure list (DM home) |
| `/adventures/:id` | Adventure detail — players, scenes, encounters, playlists |
| `/run/:encounterId` | Live encounter runner (DM view) |
| `/player` | Player-facing screen — open in a separate window |
| `/help` | In-app help reference |

## Player Screen

Open the player screen from any GM page ("Open Player Screen" button). Move it to your TV or secondary monitor. The DM view syncs to it via the BroadcastChannel API and localStorage, so it also works correctly on reload.

## Desktop App

The packaged Electron app runs its own local Hono server and SQLite database — no installation beyond the app itself is required. Your data is stored in your OS user-data folder and persists across updates.

Download the latest installer from the releases page and run it over the existing installation to update.
