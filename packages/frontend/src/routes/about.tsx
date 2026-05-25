import { createFileRoute } from '@tanstack/react-router';
import { GmHeader } from '../components/GmHeader';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

// ── Content helpers ───────────────────────────────────────────────────────────
// Use these components to author the page. Each maps to a named style below.
//
//   <Section>                  top-level content block, adds vertical spacing
//   <H2>                       section heading (gold, underlined)
//   <H3>                       subsection heading (muted gold, uppercase small)
//   <P>                        body paragraph
//   <Lead>                     intro / pull-quote paragraph (left gold border)
//   <Ul>                       unordered list wrapper
//   <Li>                       list item (◆ gold bullet)
//   <Figure src caption="…">  image with optional caption
//
// Example:
//   <Section>
//     <H2>Section Title</H2>
//     <P>Body text. Inline <strong>bold</strong> and <em>italic</em> work normally.</P>
//     <Ul>
//       <Li>First point</Li>
//       <Li>Second point</Li>
//     </Ul>
//     <Figure src="/screenshots/player-screen.png" caption="The player-facing screen." />
//   </Section>

function Section({ children }: { children: React.ReactNode }) {
  return <section style={s.section}>{children}</section>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={s.h2}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={s.h3}>{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={s.p}>{children}</p>;
}
function Lead({ children }: { children: React.ReactNode }) {
  return <p style={s.lead}>{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={s.ul}>{children}</ul>;
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={s.li}>
      <span style={s.bullet}>◆</span>
      {children}
    </li>
  );
}
function Figure({ src, caption }: { src: string; caption?: string }) {
  return (
    <figure style={s.figure}>
      <img src={src} alt={caption ?? ''} style={s.figImg} />
      {caption && <figcaption style={s.figCaption}>{caption}</figcaption>}
    </figure>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <div style={s.page}>
      <GmHeader>
        <h1 style={s.title}>About GM Assistant</h1>
      </GmHeader>

      <main style={s.main}>

        <Section>
          <Lead>
            GM Assistant is a session management tool built for tabletop game masters who want
            to keep their eyes on the table — not on a spreadsheet. Run it on your laptop while
            a second monitor or TV shows the Player Screen to your players.
          </Lead>
        </Section>

        <Section>
          <H2>What It Does</H2>
          <P>
            GM Assistant brings together the tools a GM reaches for most during a session:
            encounter tracking, initiative order, HP management, ambient music, and atmospheric
            images — all in one place, all wired directly to the player-facing display.
          </P>
          <Ul>
            <Li>Manage multiple adventures, each with their own cast of players, scenes, encounters, and playlists.</Li>
            <Li>Build encounters with PCs, NPCs, enemies, groups, events, and lair actions — each with stat blocks, conditions, and live HP bars.</Li>
            <Li>Push images and an initiative tracker to a dedicated Player Screen at the click of a button.</Li>
            <Li>Play ambient audio from uploaded files or YouTube, with shuffle, per-playlist play modes, and automatic handoff between scenes.</Li>
            <Li>Import monsters directly from the Open5e database, complete with full stat blocks and legendary action tracking.</Li>
          </Ul>
        </Section>

        <Section>
          <H2>How It Works</H2>
          <H3>The Two-Screen Setup</H3>
          <P>
            Click <strong>🖥 Player Window → Open Player Screen</strong> from any GM page to open
            the player-facing view. Drag it to your second monitor and maximise it. Everything you
            send from the GM side — images, the initiative tracker, HP changes — is pushed there
            in real time via a broadcast channel. No polling, no refresh.
          </P>
          <H3>Adventures, Encounters, and Scenes</H3>
          <P>
            An <em>adventure</em> is the top-level container. Inside it you create <em>image scenes</em>{' '}
            (collections of atmospheric art organised by location or mood), <em>encounters</em>{' '}
            (combat or event sequences with their own combatant roster), and <em>playlists</em>{' '}
            (ambient audio that can be tied to a scene image or encounter).
          </P>
          <H3>Live Encounter Tracking</H3>
          <P>
            The encounter tracker handles initiative order, active-combatant highlighting, round
            counting, HP editing, condition badges, and legendary action / resistance tracking
            for creatures that have them. Progress is saved automatically; navigating away and
            back resumes exactly where you left off.
          </P>
        </Section>

        <Section>
          <H2>Running Locally vs. Desktop</H2>
          <P>
            GM Assistant can be run as a local web server or as a self-contained desktop application.
          </P>
          <Ul>
            <Li><strong>Web / dev mode</strong> — run <code>pnpm dev</code> from the repo root. The GM interface is at <code>localhost:5173</code> and the Player Screen at <code>localhost:5173/player</code>.</Li>
            <Li><strong>Desktop app</strong> — the packaged Electron build bundles its own server and SQLite database. No internet connection required except for YouTube playback. Data persists in your OS user-data folder across updates.</Li>
          </Ul>
        </Section>

        <Section>
          <H2>Importing and Exporting</H2>
          <P>
            Adventures and encounters can be exported as <code>.gma.zip</code> files and imported
            on any other instance of GM Assistant. Use this to back up your campaigns, share
            encounters with other GMs, or move a campaign between machines.
          </P>
        </Section>

        <Section>
          <H2>Technical Notes</H2>
          <Ul>
            <Li><strong>Frontend</strong> — React 18, Vite, TanStack Router, TanStack Query</Li>
            <Li><strong>Backend</strong> — Hono, Drizzle ORM, LibSQL / SQLite</Li>
            <Li><strong>Desktop</strong> — Electron wrapping the same Hono backend</Li>
            <Li><strong>Monster data</strong> — Open5e API (open5e.com), used under their open licence</Li>
          </Ul>
        </Section>

      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  // Page shell
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', paddingBottom: 80 },
  title: { margin: 0, fontSize: '1.4rem', color: '#c9a84c' },
  main: { maxWidth: 860, margin: '0 auto', padding: '40px 24px' },

  // Section block — wrap each logical chunk in <Section>
  section: { marginBottom: 48 },

  // H2 — primary section heading
  h2: {
    margin: '0 0 16px',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#c9a84c',
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 8,
  },

  // H3 — subsection heading
  h3: {
    margin: '24px 0 8px',
    fontSize: '0.825rem',
    fontWeight: 700,
    color: '#a08040',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },

  // P — body paragraph
  p: {
    margin: '0 0 12px',
    fontSize: '0.925rem',
    lineHeight: 1.75,
    color: '#ccc',
  },

  // Lead — intro / pull-quote
  lead: {
    margin: '0 0 12px',
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: '#bbb',
    borderLeft: '3px solid #c9a84c',
    paddingLeft: 16,
  },

  // List
  ul: { margin: '0 0 12px', padding: 0, listStyle: 'none' },
  li: {
    position: 'relative',
    display: 'flex',
    gap: 10,
    alignItems: 'baseline',
    marginBottom: 8,
    fontSize: '0.925rem',
    lineHeight: 1.65,
    color: '#ccc',
  },
  bullet: {
    color: '#c9a84c',
    fontSize: '0.45rem',
    flexShrink: 0,
    marginTop: '0.55em',
  },

  // Figure / image
  figure: { margin: '24px 0', padding: 0 },
  figImg: {
    display: 'block',
    maxWidth: '100%',
    borderRadius: 6,
    border: '1px solid #2a2a4a',
  },
  figCaption: {
    marginTop: 8,
    fontSize: '0.8rem',
    color: '#666',
    fontStyle: 'italic',
  },
};
