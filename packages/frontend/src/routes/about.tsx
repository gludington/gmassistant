import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GmHeader } from '../components/GmHeader';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

// ── Content helpers ───────────────────────────────────────────────────────────
// Use these components to author the page. Each maps to a named style below.
//
//   <Section>                      top-level content block, adds vertical spacing
//   <H2>                           section heading (gold, underlined)
//   <H3>                           subsection heading (muted gold, uppercase small)
//   <P>                            body paragraph
//   <Lead>                         intro / pull-quote paragraph (left gold border)
//   <Ul>                           unordered list — wrap <Li> items
//   <Li>                           unordered list item (◆ gold bullet)
//   <Ol>                           ordered list — wrap <OlLi> items; numbers auto-injected
//   <OlLi>                         ordered list item (gold number, same layout as Li)
//   <A href="…">                   external link (gold, opens in new tab)
//   <SiteLink to="/page">          internal link (gold, same-tab TanStack navigation)
//   <Figure src="…" caption="…">  image with optional caption
//   <FaqItem question="…">        collapsible FAQ entry (details/summary); nest inside a <Section>
//
// Example:
//   <Section>
//     <H2>Section Title</H2>
//     <P>Body text. Inline <strong>bold</strong> and <em>italic</em> work normally.</P>
//     <P>External: <A href="https://example.com">link text</A>. Internal: <SiteLink to="/help">Help</SiteLink>.</P>
//     <Ul>
//       <Li>Unordered point</Li>
//     </Ul>
//     <Ol>
//       <OlLi>First step</OlLi>
//       <OlLi>Second step</OlLi>
//     </Ol>
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
// Ol auto-injects a 1-based index into each OlLi child.
function Ol({ children }: { children: React.ReactNode }) {
  return (
    <ol style={s.ol}>
      {React.Children.map(children, (child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ _index: number }>, { _index: i + 1 })
          : child
      )}
    </ol>
  );
}
function OlLi({ children, _index }: { children: React.ReactNode; _index?: number }) {
  return (
    <li style={s.li}>
      <span style={s.olNumber}>{_index ?? '1'}.</span>
      {children}
    </li>
  );
}
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} style={s.a} target="_blank" rel="noopener noreferrer">{children}</a>;
}
function SiteLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to as Parameters<typeof Link>[0]['to']} style={s.a}>{children}</Link>;
}
function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details style={s.faqDetails}>
      <summary style={s.faqSummary}>{question}</summary>
      <div style={s.faqBody}>{children}</div>
    </details>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            to keep their eyes on the table — not on a spreadsheet. Use the GM screen to help
            run your encounters, or put a second monitor or TV screen in front of your players
            to show Player views both in and out of combat.
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
            <Li>Build encounters with PCs, enemies, groups, events, and lair actions — each with stat blocks, conditions, and live HP bars.</Li>
            <Li>Push images and an initiative tracker to a dedicated Player Screen at the click of a button.</Li>
            <Li>Play audio from uploaded files or YouTube, with shuffle, per-playlist play modes, and automatic handoff between scenes.</Li>
            <Li>Import monsters directly from the <A href="https://open5e.com/">Open5e</A> database, complete with full stat blocks and legendary action tracking.</Li>
          </Ul>
        </Section>

        <Section>
          <H2>How It Works</H2>
          <H3>The GM Screen</H3>
          <p>The GM Screen is the central hub for managing your game session. From here, you can create and manage adventures, encounters, playlists, and scenes,
            as well as track initiative, hit points, and conditions during combat.</p>
          <H3>The Two-Screen Setup</H3>
          <P>
            If you have a second monitor or TV screen, you can show a player-facing view using <strong>🖥 Player Window → Open Player Screen</strong> 
            Drag it to your second monitor and maximise it. Everything you
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
            GM Assistant runs in two modes. The web/dev mode is for development or running it
            as a local server; the desktop app is a self-contained Electron build for everyday use.
          </P>
          <H3>Web / Dev Mode</H3>
          <P>
            Run <code>pnpm dev</code> from the repo root. The GM interface is at{' '}
            <code>localhost:5173</code> and the Player Screen at <code>localhost:5173/player</code>.
          </P>
          <H3>Desktop App</H3>
          <P>
            The packaged Electron build bundles its own server and SQLite database. It works
            completely offline and data persists in your OS user-data folder across updates.
            The only features that require an internet connection are:
          </P>
          <Ol>
            <OlLi>Stat block import from <A href="https://open5e.com/">Open5e</A></OlLi>
            <OlLi><A href="https://www.youtube.com/">YouTube</A> audio playback</OlLi>
          </Ol>
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
            <Li><strong>Monster data</strong> — <A href="https://open5e.com/">Open5e API</A>, used under their open licence</Li>
            <li><strong>YouTube audio</strong> — played through the YouTube API with iframe optionally visible.</li>
          </Ul>
          <P>See also: <SiteLink to="/help">Help page</SiteLink> for a full feature walkthrough.</P>
        </Section>
        <Section>
          <H2>Frequently Asked Questions</H2>

          <FaqItem question="Does it work offline?">
            <P>
              Almost entirely. The desktop app bundles its own server and database and requires no
              internet connection for normal use. The two exceptions are importing monster stat blocks
              from <A href="https://open5e.com/">Open5e</A> and playing YouTube audio, both of which
              stream from external services.
            </P>
          </FaqItem>

          <FaqItem question="Can multiple GMs use it at the same time?">
            <P>
              Not currently. GM Assistant is designed as a single-user tool. There is no authentication,
              authorisation, or conflict resolution for concurrent edits. Running the server on a local
              network and opening it from a second machine is technically possible but unsupported —
              you may see stale data if two browsers edit the same adventure simultaneously.
            </P>
          </FaqItem>

          <FaqItem question="Where is my data stored?">
            <P>
              In the desktop app, your SQLite database and uploaded files are stored in your OS
              user-data directory (<code>AppData/Roaming</code> on Windows, <code>~/Library/Application Support</code>{' '}
              on macOS, <code>~/.config</code> on Linux). In dev/server mode the database defaults to the
              repo root and uploads go into an <code>uploads/</code> folder next to the server process.
            </P>
          </FaqItem>

          <FaqItem question="How do I back up my campaigns?">
            <P>
              Use <strong>↓ Export Adventure</strong> on the home screen. This produces a{' '}
              <code>.gma.zip</code> archive that includes all scenes, encounters, players, playlists,
              and uploaded audio files. You can reimport it on any instance of GM Assistant using{' '}
              <strong>↑ Import Adventure</strong>.
            </P>
          </FaqItem>

          <FaqItem question="How do I set up the two-screen display?">
            <P>
              Click <strong>🖥 Player Window → Open Player Screen</strong> from any GM page. A new
              browser window opens at <code>/player</code>. Drag it to your players' monitor and
              maximise or fullscreen it. Everything you push from the GM side — images, initiative
              tracker, HP changes — appears there instantly with no page reload required.
            </P>
          </FaqItem>

          <FaqItem question="Can I import monsters from other sources?">
            <P>
              The built-in search covers the <A href="https://open5e.com/">Open5e</A> database, which
              includes the SRD 5.1 monsters and a large collection of third-party content. For monsters
              not in Open5e you can paste a raw JSON stat block directly into the stat block field when
              creating or editing a combatant.
            </P>
          </FaqItem>

          <FaqItem question="What audio formats are supported?">
            <P>
              Uploaded files: MP3, M4A, AAC, OGG, FLAC, WAV, Opus, WebM, MP4, WMA, AIFF. YouTube
              links are also supported and stream directly in the browser. Uploaded audio works
              fully offline in the desktop build; YouTube requires an internet connection.
            </P>
          </FaqItem>
          <FaqItem question="Does this work on tablets or phones?">
            <P>
              Not currently, no.  The web server version may be accessible on a tablet or phone, but the UI is not optimized for it, and some features, like YouTube audio playback, may not work at all.
              There is no installable mobile app.
            </P>
          </FaqItem>
          <FaqItem question="Do you take bug reports or feature requests?">
            <P>
              I built this tool for my own use, but you can open an issue on <A href="https://github.com/greenmatter/gm-assistant">GitHub</A>.
            </P>
          </FaqItem>
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

  // Ul — unordered list
  ul: { margin: '0 0 12px', padding: 0, listStyle: 'none' },

  // Ol — ordered list (numbers rendered by OlLi)
  ol: { margin: '0 0 12px', padding: 0, listStyle: 'none' },

  // Shared li layout (used by both Li and OlLi)
  li: {
    display: 'flex',
    gap: 10,
    alignItems: 'baseline',
    marginBottom: 8,
    fontSize: '0.925rem',
    lineHeight: 1.65,
    color: '#ccc',
  },

  // ◆ bullet for Ul items
  bullet: {
    color: '#c9a84c',
    fontSize: '0.45rem',
    flexShrink: 0,
    marginTop: '0.55em',
  },

  // Number for Ol items
  olNumber: {
    color: '#c9a84c',
    fontSize: '0.8rem',
    fontWeight: 700,
    flexShrink: 0,
    minWidth: '1.4em',
    textAlign: 'right',
  },

  // A / SiteLink — inline links
  a: {
    color: '#c9a84c',
    textDecoration: 'underline',
    textDecorationColor: '#c9a84c55',
    textUnderlineOffset: '3px',
    cursor: 'pointer',
  },

  // FaqItem — details/summary accordion
  faqDetails: {
    marginBottom: 8,
    background: '#16213e',
    border: '1px solid #2a2a4a',
    borderRadius: 6,
    overflow: 'hidden',
  },
  faqSummary: {
    padding: '12px 16px',
    fontSize: '0.925rem',
    fontWeight: 600,
    color: '#c9a84c',
    cursor: 'pointer',
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    userSelect: 'none' as const,
  },
  faqBody: {
    padding: '0 16px 14px',
    borderTop: '1px solid #2a2a4a',
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
