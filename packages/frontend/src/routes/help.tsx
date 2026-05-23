import { createFileRoute } from '@tanstack/react-router';
import { GmHeader } from '../components/GmHeader';

export const Route = createFileRoute('/help')({
  component: HelpPage,
});

function HelpPage() {
  return (
    <div style={page}>
      <GmHeader>
        <h1 style={title}>Help</h1>
      </GmHeader>
      <main style={main}>
        <p style={intro}>
          GM Assistant is a session management tool for tabletop GMs. Run it on your laptop while
          a second monitor or TV shows the Player Screen for your players.
        </p>

        <div style={grid}>
          <Card icon="🗺" heading="Adventures">
            <Item label="Create">From the home screen, click <em>+ New Adventure</em>. Each adventure holds its own players, scenes, encounters, and playlists.</Item>
            <Item label="Navigate">Click an adventure card to open it. Use the logo or <em>← Adventures</em> to go back.</Item>
            <Item label="Edit name">Click the ✎ pencil icon next to the adventure title.</Item>
          </Card>

          <Card icon="👥" heading="Players">
            <Item label="Add">Open an adventure and use <em>+ Add Player</em> in the Players section.</Item>
            <Item label="Fields">Name, Max HP, Initiative modifier, AC, Spell Save DC, Passive Perception, color dot. All optional except name and HP.</Item>
            <Item label="Reuse">Players persist across all encounters in the adventure — add them once, they appear in every encounter.</Item>
          </Card>

          <Card icon="🖼" heading="Image Scenes">
            <Item label="Scenes">Group images into named scenes (e.g. <em>Tavern</em>, <em>Dungeon Level 2</em>). Click <em>Manage</em> to expand.</Item>
            <Item label="Upload">Click <em>+ Add Images</em> to upload one or more image files.</Item>
            <Item label="Show">Click <strong>▶ Show</strong> on any image to push it to the Player Screen. The initiative tracker is hidden when an image is shown.</Item>
            <Item label="Fit modes"><em>Cover</em> — fills the screen (may crop edges). <em>Fit</em> — letterboxed, whole image visible. <em>Center</em> — natural size, centred.</Item>
            <Item label="Reorder">Drag the <em>⠿</em> grip at the top-left of any tile to reorder images within a scene.</Item>
            <Item label="Per-image playlist">Attach a playlist to an image using the 🎵 selector below it. The playlist starts playing automatically when you show that image.</Item>
          </Card>

          <Card icon="⚔" heading="Encounters">
            <Item label="Create">Click <em>+ Add Encounter</em> in the Encounters section. Optionally attach a playlist to play during combat.</Item>
            <Item label="Combatant types">
              <em>PC</em> — links to an adventure player (HP synced). <em>NPC</em> / <em>Enemy</em> — individual creatures.{' '}
              <em>Group</em> — multiple monsters sharing a single HP pool. <em>Event</em> / <em>Lair</em> — non-creature entries for initiative timing.
            </Item>
            <Item label="Run">Click <strong>▶ Run</strong> to open the encounter tracker.</Item>
          </Card>

          <Card icon="🎲" heading="Encounter Tracker">
            <Item label="Initiative">Set values by clicking the initiative number, or use <em>Roll All Initiative</em> to auto-roll d20 + modifier for everyone.</Item>
            <Item label="Active combatant">Use <strong>◀ ▶</strong> in the header to cycle turn order. The round counter increments when you wrap around.</Item>
            <Item label="HP">Click a combatant's HP to edit it inline. Damage and healing update the bar in real time.</Item>
            <Item label="Conditions">Click the condition badge area on any combatant to add or remove status conditions.</Item>
            <Item label="Player screen">Use <em>⚔ Show/Hide Initiative</em> and <em>❤ Show/Hide HP</em> to control what players see. Click <strong>▶ Show on Player</strong> to send the tracker to the Player Screen.</Item>
            <Item label="Stat blocks">Click a combatant name to open its stat block (if one has been attached).</Item>
          </Card>

          <Card icon="🎵" heading="Playlists & Audio">
            <Item label="Create">In an adventure, use the Playlists section to create named playlists.</Item>
            <Item label="Add tracks">Click <em>Manage</em> then <em>+ Add Track</em>. Choose <em>YouTube</em> (paste a URL) or <em>Upload File</em> (MP3, M4A, OGG, FLAC, WAV, MP4, Opus, and more).</Item>
            <Item label="Reorder">Drag the <em>⠿</em> grip to reorder tracks within a playlist.</Item>
            <Item label="Play">Click <strong>▶</strong> next to a playlist name, or attach it to an image or encounter so it starts automatically.</Item>
            <Item label="AudioBar">The bar at the bottom of every GM page shows the currently playing track. Use <strong>⏮ ⏭</strong> to skip, <strong>⏸</strong> to pause, <strong>⏹</strong> to stop.</Item>
            <Item label="Shuffle">Click <strong>🔀</strong> in the AudioBar to toggle shuffle mode. The button is gold when shuffle is on. Your preference is remembered.</Item>
            <Item label="Continuity">If you navigate to a scene or encounter whose playlist is already playing, the music continues uninterrupted.</Item>
          </Card>

          <Card icon="📺" heading="Player Screen">
            <Item label="Open">Click <em>Open Player Screen</em> from any GM page. Move the window to your players' monitor and maximise it.</Item>
            <Item label="Images">Images appear when you click ▶ Show on a scene image.</Item>
            <Item label="Initiative">The encounter tracker is shown when you click ▶ Show on Player in the tracker and hidden when you push an image.</Item>
            <Item label="Blank">Click <em>Blank Screen</em> to clear whatever is shown.</Item>
            <Item label="Desktop app">The Player Screen window goes fullscreen automatically in the packaged desktop application.</Item>
          </Card>

          <Card icon="🖥" heading="Desktop App">
            <Item label="Self-contained">The desktop build runs its own local server and SQLite database — no internet connection required (except for YouTube playback).</Item>
            <Item label="Data location">Your data is stored in your OS user-data folder and persists across updates.</Item>
            <Item label="Updates">Download a new installer from the releases page and run it over the existing installation.</Item>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ icon, heading, children }: { icon: string; heading: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={cardHead}>
        <span style={cardIcon}>{icon}</span>
        <h2 style={cardTitle}>{heading}</h2>
      </div>
      <dl style={dl}>{children}</dl>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={dt}>{label}</dt>
      <dd style={dd}>{children}</dd>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', paddingBottom: 80 };
const title: React.CSSProperties = { margin: 0, fontSize: '1.4rem', color: '#c9a84c' };

const main: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' };

const intro: React.CSSProperties = {
  color: '#999', fontSize: '0.95rem', marginBottom: 32,
  borderLeft: '3px solid #c9a84c', paddingLeft: 16,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 16,
};

const card: React.CSSProperties = {
  background: '#16213e',
  border: '1px solid #2a2a4a',
  borderRadius: 8,
  padding: '18px 20px',
};

const cardHead: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
  borderBottom: '1px solid #2a2a4a', paddingBottom: 10,
};

const cardIcon: React.CSSProperties = { fontSize: '1.3rem' };

const cardTitle: React.CSSProperties = {
  margin: 0, fontSize: '1rem', fontWeight: 700, color: '#c9a84c',
};

const dl: React.CSSProperties = { margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', alignItems: 'baseline' };

const dt: React.CSSProperties = {
  color: '#c9a84c', fontSize: '0.75rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap', paddingTop: 1,
};

const dd: React.CSSProperties = {
  margin: 0, fontSize: '0.82rem', color: '#bbb', lineHeight: 1.5,
};
