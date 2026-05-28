# Features

GM Assistant brings together the tools a GM reaches for most during a session, wired directly to a player-facing display.

## Encounter Tracker

The GM-facing combat view. Manages initiative, HP, and conditions with a live feed to the Player Screen.

![Encounter Tracker](/help/tracker.png)

- **Initiative** — roll all d20s at once or set manually per combatant
- **HP editing** — click to type, or use the +/− buttons and the damage/heal fields
- **Conditions** — Blinded, Charmed, Frightened, and 15+ others; appear as coloured chips on the player screen; Bloodied is applied automatically
- **Legendary actions & resistances** — per-creature counters that reset each round
- **Groups** — multiple monsters share an initiative slot; expand on the player screen to show individual HP and conditions
- **Temporary combatants** — add mid-fight entries that don't persist to the roster
- **Stat blocks** — import from [Open5e](https://open5e.com/) and view in a side panel during combat
- **Auto-save** — navigate away and back to resume exactly where you left off

## Ambient Audio

A persistent audio bar at the bottom of every GM page keeps music running as you navigate.

- **YouTube** — paste any video URL; plays through the YouTube IFrame API
- **File upload** — MP3, M4A, OGG, FLAC, WAV, Opus, and more; stored locally
- **Playlists** — per-adventure; attach to scenes or encounters for automatic playback
- **Shuffle & loop** — per-playlist toggles, saved automatically
- **Seamless handoff** — switching to a scene/encounter whose playlist is already playing doesn't restart the track

## Scene Images

Push atmospheric artwork to the Player Screen instantly.

- Upload multiple images per scene (organised by location or mood)
- **Fit modes** — Cover, Fit, and Center; changing mode on a live image updates the player screen without re-sending
- **Playlist attachment** — associate a playlist with an image so it starts when you show the image
- Drag-to-reorder within a scene

## Player Screen

A dedicated second window for a TV, projector, or second monitor.

![Player Screen](/help/players.png)

- Shows scene images as the background
- Initiative tracker overlays the bottom of the screen during combat
- HP bars, condition chips, and active-combatant highlight all update in real time
- **No refresh** — updates arrive via a browser BroadcastChannel; the window never reloads
- In the desktop app, the Player Screen window opens fullscreen automatically

## Adventure Management

Adventures are the top-level container for everything.

![Adventure Manager — Players and Encounters](/help/encounters.png)

- **Players** — add persistent characters once; they appear automatically in every encounter
- **Scenes** — organise images by location or mood
- **Encounters** — each has its own combatant roster; PCs, NPCs, enemies, groups, events, and lair actions
- **Playlists** — per-adventure audio libraries

## Desktop App

A self-contained Electron application for everyday use.

- **No server setup** — bundles its own Hono backend and SQLite database
- **Fully offline** — everything works without internet except Open5e stat block import and YouTube audio
- **Data persistence** — stored in your OS user-data folder; survives app updates
- Available for **macOS** (Intel & Apple Silicon), **Windows**, and **Linux**

## Import & Export

`.gma.zip` archives for backup, sharing, and migration.

- Export an entire adventure (scenes, encounters, playlists, uploaded audio)
- Export a single encounter (roster and stat blocks)
- Import on any other instance of GM Assistant
- YouTube links are stored by URL and don't add to archive size
