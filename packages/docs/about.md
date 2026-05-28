# About GM Assistant

GM Assistant is a session management tool built for tabletop game masters who want to keep their eyes on the table — not on a spreadsheet. Use the GM screen to run your encounters, or put a second monitor or TV in front of your players to show a live player view both in and out of combat.

## What It Does

GM Assistant brings together the tools a GM reaches for most during a session: encounter tracking, initiative order, HP management, ambient music, and atmospheric images — all in one place, all wired directly to the player-facing display.

- Manage multiple adventures, each with their own cast of players, scenes, encounters, and playlists.
- Build encounters with PCs, enemies, groups, events, and lair actions — each with stat blocks, conditions, and live HP bars.
- Push images and an initiative tracker to a dedicated Player Screen at the click of a button.
- Play audio from uploaded files or YouTube, with shuffle, per-playlist loop modes, and automatic handoff between scenes.
- Import monsters directly from the [Open5e](https://open5e.com/) database, complete with full stat blocks and legendary action tracking.

## How It Works

### The GM Screen

The GM Screen is the central hub for managing your game session. From here you create and manage adventures, encounters, playlists, and scenes, as well as track initiative, hit points, and conditions during combat.

### The Two-Screen Setup

If you have a second monitor or TV, open **🖥 Player Window → Open Player Screen** and drag it to the second display. Everything you send from the GM side — images, the initiative tracker, HP changes — is pushed there in real time via a BroadcastChannel. No polling, no refresh.

### Adventures, Encounters, and Scenes

An *adventure* is the top-level container. Inside it you create *image scenes* (collections of atmospheric art organised by location or mood), *encounters* (combat sequences with their own combatant roster), and *playlists* (ambient audio that can be tied to a scene or encounter).

### Live Encounter Tracking

The encounter tracker handles initiative order, active-combatant highlighting, round counting, HP editing, condition badges, and legendary action/resistance tracking. Progress is saved automatically; navigating away and back resumes exactly where you left off.

## Running Locally vs. Desktop

### Web / Dev Mode

Clone the repository and run `pnpm dev` from the root. The GM interface is at `localhost:5173` and the Player Screen at `localhost:5173/player`.

### Desktop App

The packaged Electron build bundles its own server and SQLite database. It works completely offline and data persists in your OS user-data folder across updates. The only features that require an internet connection are:

1. Stat block import from [Open5e](https://open5e.com/)
2. [YouTube](https://www.youtube.com/) audio playback

See the [Help page](/help#desktop-app) for installation instructions.

## Importing and Exporting

Adventures and encounters can be exported as `.gma.zip` files and imported on any other instance of GM Assistant. Use this to back up your campaigns, share encounters with other GMs, or move a campaign between machines.

## Technical Notes

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TanStack Router, TanStack Query |
| Backend | Hono, Drizzle ORM, LibSQL / SQLite |
| Desktop | Electron wrapping the same Hono backend |
| Monster data | [Open5e API](https://open5e.com/), used under their open licence |
| Audio | YouTube IFrame API; HTML5 Audio for local files |

## Frequently Asked Questions

**Does it work offline?**

Almost entirely. The desktop app requires no internet connection for normal use. The two exceptions are importing monster stat blocks from Open5e and playing YouTube audio, both of which stream from external services.

**Can multiple GMs use it at the same time?**

Not currently. GM Assistant is designed as a single-user tool. There is no authentication and no multi-user conflict resolution.

**Where is my data stored in the desktop app?**

In your OS user-data folder — the same location Electron uses for app data by default. It is not touched by app updates or reinstalls.

**Can I use it in a browser without the desktop app?**

Yes. Run `pnpm dev` from the repository root and open `localhost:5173`. The Player Screen opens at `localhost:5173/player` in a second window.

**Is the source code available?**

Yes — [github.com/gludington/gmassistant](https://github.com/gludington/gmassistant).
