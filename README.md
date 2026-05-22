# gmassisstant

A D&D tabletop session assistant for Game Masters. Manage adventures, encounters, and combatants from a DM interface while pushing a live initiative tracker to a separate player-facing screen.

## Features

- **Adventure management** — create adventures with players, image scenes, and encounters
- **Encounter runner** — live initiative tracker with prev/next navigation, round counter, HP tracking, and condition management
- **Player screen** — separate full-screen view for a TV or monitor, synced in real time via BroadcastChannel
- **D&D 2024 conditions** — all 17 conditions including Bloodied (auto-applied at 50% HP)
- **Group combatants** — track groups of enemies with per-member HP and conditions
- **Image scenes** — upload and push background images to the player screen
- **Open5e integration** — search the Open5e monster database and import directly into encounters

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5, TanStack Router v1, TanStack Query v5 |
| Backend | Hono v4, Drizzle ORM, LibSQL (SQLite) |
| Monorepo | pnpm workspaces |
| Shared types | `@gmassisstant/types` |

## Project Structure

```
packages/
  backend/   — Hono API server + Drizzle schema
  frontend/  — React SPA
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

From the repo root, start both backend and frontend:

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
| `/adventures/:id` | Adventure detail — manage players, scenes, encounters |
| `/run/:encounterId` | Live encounter runner (DM view) |
| `/player` | Player-facing screen — open in a separate window |

## Player Screen

Open the player screen from the adventure detail page ("Open Player Screen" button). It should be moved to your TV or secondary monitor. The DM view syncs to it via the BroadcastChannel API and localStorage, so it also works correctly on reload.
