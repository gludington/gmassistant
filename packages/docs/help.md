# Help

GM Assistant is a session management tool for tabletop GMs. Run encounters, manage ambient audio, push images and initiative trackers to a player-facing screen — all from a single interface. This page covers every feature in the order you are likely to encounter it.

**Contents:** [Home Screen](#home-screen) · [Adventure Manager](#adventure-manager) · [Encounter Tracker](#encounter-tracker) · [Playlists & Audio](#playlists-audio) · [Player Screen](#player-screen) · [Desktop App](#desktop-app) · [Import & Export](#import-export)

---

## Home Screen

The home screen is your library of adventures. Each adventure card shows the adventure name and a count of its encounters and players.

### Creating an Adventure

1. Click **+ New Adventure** at the top of the adventure list.
2. Enter a name and confirm. The adventure opens immediately.

### Managing Adventures

- Click an adventure card to open its manager.
- Click the **✎** pencil icon on any card to rename it inline.
- Click **↑ Import Adventure** to restore a previously exported `.gma.zip` file.

> **Tip:** Adventures are independent — players, scenes, and playlists belong to a single adventure and are not shared between them.

---

## Adventure Manager

The adventure manager is the hub for everything in a campaign. It is divided into four collapsible panels: **Players**, **Image Scenes**, **Encounters**, and **Playlists**.

### Players

Players are the persistent characters who appear in every encounter in this adventure. Add them once here; they are automatically included in the combatant roster when you run any encounter. AC, Passive Perception, and Spell Save DC will display persistently for the GM if you enter them.

![Player Management](/help/players.png)

- Click **+ Add Player** to create a new player.
- Fields: Name (required), Max HP (required), Initiative modifier, AC, Spell Save DC, Passive Perception, and a colour dot used on the player screen.
- Click a player row to edit it. Changes take effect immediately in any running encounter.

### Image Scenes

Scenes group atmospheric artwork by location or mood. Clicking **▶ Show** on an image pushes it to the Player Screen instantly. You can attach a playlist to an image so that it starts automatically when the image is shown.

- Click **+ Add Scene** to create a named scene (e.g. *Tavern Interior*, *Boss Chamber*).
- Click **Manage** on a scene to expand it and add images.
- Click **+ Add Images** to upload one or more image files.
- Drag the **⠿** grip on any image tile to reorder images within a scene.
- Click the fit mode buttons (*Cover / Fit / Center*) below an image to control how it fills the player screen.
- Click **🎵** below an image to attach a playlist. That playlist starts automatically whenever you show the image.

> **Tip:** **Cover** fills the entire screen (may crop edges). **Fit** shows the full image with letterboxing. **Center** displays the image at its natural resolution, centred.

### Encounters

Each encounter has its own combatant roster, drawn from the adventure players plus any NPCs, enemies, groups, or special entries you add.

![Encounter Management](/help/encounters.png)

- Click **+ Add Encounter** to create one. Give it a name and optionally attach a playlist to play during combat.
- Click **Manage** to expand the combatant list and add or remove entries before running.
- Combatant types:
  - **PC** — links to an adventure player (HP synced automatically).
  - **NPC / Enemy** — a single creature with its own HP and stat block.
  - **Group** — multiple monsters sharing an initiative count (e.g. *3× Goblin*). The group can be expanded on the player screen to show each member's HP and conditions.
  - **Event / Lair Action** — non-creature entries for initiative-order timing.
- By default, Enemies and Groups are visible on the player screen; Events and Lair Actions are not. Visibility can be toggled before or during the encounter.
- Click **Open5e Search** on any enemy or NPC to import its stat block from the [Open5e](https://open5e.com/) monster database.
- Click **▶ Run** to open the encounter tracker.

---

## Encounter Tracker

The encounter tracker is the GM-facing combat view. It manages initiative order, HP, conditions, and what the players see on their screen.

![Encounter Tracker](/help/tracker.png)

### Starting Combat

1. Click **Roll All Initiative** to roll d20 + modifier for every combatant, or click any initiative number to set it manually.
2. Click **▶ Show on Player** (in the Player Window menu) to push the tracker to the Player Screen. The menu also lets you toggle whether initiative numbers and HP bars are visible to players.
3. Use **◀ ▶** in the header to advance turns. The round counter increments when the order wraps around.

### HP and Conditions

- Edit hit points in three ways:
  1. Click the HP value to type directly.
  2. Click the red or green buttons to decrease/increase by that amount.
  3. Enter a value next to the DMG or HEAL buttons, then click the button.
- Click the condition badge area **🩹** on any row to add or remove status conditions (Blinded, Charmed, Frightened, etc.). Conditions appear as coloured chips and are visible on the player screen. **Bloodied** is applied automatically when HP drops below half maximum.
- Legendary action and resistance counters appear for creatures that have them and reset each round.

### Player Screen Controls

The **Player Window** menu in the header controls what players see:

- **Show/Hide Initiative** — toggles the initiative order on the player screen.
- **Show/Hide HP** — toggles HP bars on the player screen.
- **Show on Player / Hide from Player** — sends the full tracker to the player screen or removes it.

### Stat Blocks

- Click a combatant's name to open its stat block in a side panel (if attached).
- Stat blocks imported from Open5e include full ability scores, actions, legendary actions, and resistances.

### Ending the Encounter

- Click **End Encounter** to close the tracker and return to the adventure manager. Encounter progress is cleared.
- Click **Reset** to return all combatants to full HP and clear initiative without leaving the tracker.
- Navigating away mid-encounter automatically saves progress; running the encounter again resumes where you left off.

> **Tip:** Use **+ Add Combatant** to add entries mid-encounter. Temporary combatants exist only for the current run and are not saved back to the roster.

---

## Playlists & Audio

GM Assistant plays ambient audio through a persistent bar at the bottom of every GM page. Playlists belong to an adventure and can be attached to images or encounters to start automatically.

### Creating Playlists and Adding Tracks

1. In the adventure manager, open the **Playlists** panel and click **+ Add Playlist**.
2. Click **▼** on the playlist to expand it.
3. Click **+ Add Track** and choose a source:
   - **YouTube** — paste any YouTube video URL.
     - Use the **YT** button in the audio bar to access features associated with your YouTube account (e.g. ad-free playback with YouTube Premium).
     - YouTube audio is never downloaded; it streams from YouTube in accordance with their terms of service. An internet connection is required.
   - **Upload File** — MP3, M4A, OGG, FLAC, WAV, Opus, and most common audio formats.
4. Drag the **⠿** grip to reorder tracks within the playlist.

### Playing Audio

- Click **▶** next to a playlist name to start playing it immediately.
- Attach a playlist to a scene image or encounter so it starts automatically when you show or run it.
- If you navigate to a scene or encounter whose playlist is already playing, the music continues uninterrupted.

### Playlist Row Buttons

Each playlist in the drawer has a row of icon buttons on the right:

| Button | Action |
|--------|--------|
| **↕ / 🔀** | Toggle shuffle. Grey (↕) = sequential; gold (🔀) = shuffle. |
| **↺ / 🔁** | Toggle loop. Grey (↺) = stop after last track; gold (🔁) = restart. |
| **▶** | Start playing this playlist immediately. Gold while active. |
| **▼ / ▲** | Expand or collapse the track list. |
| **↓** | Export the playlist as a `.gma.zip` file. |
| **🗑** | Delete the playlist and all its tracks (requires confirmation). |

### The Audio Bar

The bar pinned to the bottom of every GM page shows the currently-playing track and playback controls.

- **⏮ ⏭** — skip to the previous or next track.
- **⏸** — pause / resume.
- **⏹** — stop and clear the current track.
- **🔀** — toggle shuffle.
- Click the playlist name to open the Playlists drawer.

> **Tip:** YouTube playback requires an internet connection. All uploaded audio works offline in the desktop build.

---

## Player Screen

The Player Screen is a separate browser window designed to be shown to your players on a second monitor, TV, or projector. It receives updates from the GM interface in real time — no refresh needed.

### Opening the Player Screen

1. Click **🖥 Player Window** in the GM header.
2. Select **Open Player Screen**. A new window opens at `/player`.
3. Drag the window to your players' monitor and maximise or fullscreen it.

### What Players See

- **Images** — displayed when you click **▶ Show** on a scene image.
- **Initiative tracker** — shown when you click **Show on Player** from the encounter tracker. It overlays the bottom of the screen over whatever image is currently displayed.
- **HP bars** — visible when Show HP is enabled.
- **Conditions** — condition chips appear under each combatant's name.

### Controlling the Display

- Click **⬛ Blank Screen** (in the Player Window menu) to clear the current image and hide the initiative tracker instantly.
- Changing the fit mode on an image that is currently showing updates the player screen immediately without re-sending the image.

> **Tip:** In the packaged desktop app, the Player Screen window automatically enters fullscreen when opened.

---

## Desktop App

The desktop build is a self-contained Electron application. It bundles the GM Assistant server and SQLite database so that the app runs entirely on your local machine — no server setup, no browser required.

### Installation

Download the installer for your platform from the [releases page](https://github.com/gludington/gmassistant/releases):

- **macOS Apple Silicon (M-series)** — download the `arm64.dmg`
- **macOS Intel** — download the `x64.dmg`
- **Windows** — download the `.exe` installer
- **Linux** — download the `.AppImage` or `.deb`

### What Works Offline

Everything works offline except:

1. Stat block import from [Open5e](https://open5e.com/) (requires internet to query the API).
2. YouTube audio playback (streams from YouTube's servers).

### Data and Updates

- Your data is stored in your OS user-data folder. It persists across updates — installing a new version does not touch your campaigns.
- To update, download the latest installer from the releases page and run it over the existing installation.

---

## Import & Export

Adventures and encounters can be packaged into `.gma.zip` files for backup, migration, or sharing with other GMs.

### Exporting

- On the home screen, click **↓ Export Adventure** on any adventure card to export the entire adventure (all scenes, encounters, playlists, and uploaded audio).
- From inside an adventure, click **↓ Export Encounter** to export a single encounter, including its combatant roster and stat blocks.
- From the Playlists drawer, click **↓** on any playlist to export it including uploaded audio files.

### Importing

- On the home screen, click **↑ Import Adventure** to restore an exported adventure archive.
- From inside an adventure, click **↑ Import Encounter** to add a previously exported encounter to the current adventure.

> **Tip:** Exported archives include uploaded audio files, so they can be large. YouTube links are stored by URL and do not add to the archive size.
