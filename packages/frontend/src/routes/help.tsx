import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GmHeader } from "../components/GmHeader";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

// ── Content helpers ───────────────────────────────────────────────────────────
// Use these components to author each section. Identical system to about.tsx.
//
//   <Section id="anchor">           top-level content block; id is optional but enables ToC links
//   <H2>                            section heading (gold, underlined)
//   <H3>                            subsection heading (muted gold, uppercase small)
//   <P>                             body paragraph
//   <Lead>                          intro / pull-quote paragraph (left gold border)
//   <Ul>                            unordered list — wrap <Li> items
//   <Li>                            unordered list item (◆ gold bullet)
//   <Ol>                            ordered list — wrap <OlLi> items; numbers auto-injected
//   <OlLi>                          ordered list item (gold number, same layout as Li)
//   <A href="…">                    external link (gold, opens in new tab)
//   <SiteLink to="/page">           internal link (gold, same-tab TanStack navigation)
//   <Figure src="…" caption="…">      image with optional caption
//   <FigureZoom src="…" caption="…">  thumbnail that opens a full-size lightbox on click
//   <Tip>                              callout box for tips / warnings
//   <KbdRow>                        row of label + <Kbd> shortcut chips
//
// Example section:
//
//   <Section id="my-section">
//     <H2>My Section</H2>
//     <Lead>One-line summary of what this section covers.</Lead>
//     <H3>Subsection</H3>
//     <P>Body text. Inline <strong>bold</strong> and <em>italic</em> work normally.</P>
//     <P>External: <A href="https://example.com">link</A>. Internal: <SiteLink to="/about">About</SiteLink>.</P>
//     <Ul>
//       <Li>Unordered point</Li>
//       <Li>Another point with <code>inline code</code></Li>
//     </Ul>
//     <Ol>
//       <OlLi>First step</OlLi>
//       <OlLi>Second step</OlLi>
//     </Ol>
//     <Tip>Something worth calling out.</Tip>
//     <Figure src="/screenshots/my-screen.png" caption="Caption text." />
//   </Section>

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={s.section}>
      {children}
    </section>
  );
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
      <span>{children}</span>
    </li>
  );
}
function Ol({ children }: { children: React.ReactNode }) {
  return (
    <ol style={s.ol}>
      {React.Children.map(children, (child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ _index: number }>,
              { _index: i + 1 },
            )
          : child,
      )}
    </ol>
  );
}
function OlLi({
  children,
  _index,
}: {
  children: React.ReactNode;
  _index?: number;
}) {
  return (
    <li style={s.li}>
      <span style={s.olNumber}>{_index ?? "1"}.</span>
      <span>{children}</span>
    </li>
  );
}
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={s.a} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
function SiteLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to as Parameters<typeof Link>[0]["to"]} style={s.a}>
      {children}
    </Link>
  );
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={s.tip}>
      <span style={s.tipIcon}>💡</span>
      <span>{children}</span>
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Figure({ src, caption }: { src: string; caption?: string }) {
  return (
    <figure style={s.figure}>
      <img src={src} alt={caption ?? ""} style={s.figImg} />
      {caption && <figcaption style={s.figCaption}>{caption}</figcaption>}
    </figure>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FigureZoom({ src, caption }: { src: string; caption?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <figure style={s.figure}>
        <button
          style={s.figThumbBtn}
          onClick={() => setOpen(true)}
          title="Click to enlarge"
        >
          <img src={src} alt={caption ?? ""} style={s.figThumb} />
          <span style={s.figZoomHint}>🔍 enlarge</span>
        </button>
        {caption && <figcaption style={s.figCaption}>{caption}</figcaption>}
      </figure>
      {open && (
        <div style={s.lightboxBackdrop} onClick={() => setOpen(false)}>
          <div style={s.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button style={s.lightboxClose} onClick={() => setOpen(false)}>
              ✕
            </button>
            <img src={src} alt={caption ?? ""} style={s.lightboxImg} />
            {caption && <p style={s.lightboxCaption}>{caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}

// ── Table of contents ─────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "home", label: "Home Screen" },
  { id: "adventure", label: "Adventure Manager" },
  { id: "encounter", label: "Encounter Tracker" },
  { id: "audio", label: "Playlists & Audio" },
  { id: "player", label: "Player Screen" },
  { id: "desktop", label: "Desktop App" },
  { id: "import", label: "Import & Export" },
];

function Toc() {
  return (
    <nav style={s.toc}>
      {TOC_ITEMS.map(({ id, label }) => (
        <a key={id} href={`#${id}`} style={s.tocLink}>
          {label}
        </a>
      ))}
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function HelpPage() {
  return (
    <div style={s.page}>
      <GmHeader>
        <h1 style={s.title}>Help</h1>
      </GmHeader>

      <main style={s.main}>
        <Lead>
          GM Assistant is a session management tool for tabletop GMs. Run
          encounters, manage ambient audio, push images and initiative trackers
          to a player-facing screen — all from a single interface. This page
          covers every feature in the order you are likely to encounter it.
        </Lead>

        <Toc />

        {/* ── HOME SCREEN ─────────────────────────────────────────── */}
        <Section id="home">
          <H2>Home Screen</H2>
          <P>
            The home screen is your library of adventures. Each adventure card
            shows the adventure name and a count of its encounters and players.
          </P>

          <H3>Creating an Adventure</H3>
          <Ol>
            <OlLi>
              Click <strong>+ New Adventure</strong> at the top of the adventure
              list.
            </OlLi>
            <OlLi>
              Enter a name and confirm. The adventure opens immediately.
            </OlLi>
          </Ol>

          <H3>Managing Adventures</H3>
          <Ul>
            <Li>Click an adventure card to open its manager.</Li>
            <Li>
              Click the <strong>✎</strong> pencil icon on any card to rename it
              inline.
            </Li>
            <Li>
              Click <strong>↑ Import Adventure</strong> to restore a previously
              exported <code>.gma.zip</code> file.
            </Li>
          </Ul>

          <Tip>
            Adventures are independent — players, scenes, and playlists belong
            to a single adventure and are not shared between them.
          </Tip>
        </Section>

        {/* ── ADVENTURE MANAGER ───────────────────────────────────── */}
        <Section id="adventure">
          <H2>Adventure Manager</H2>
          <P>
            The adventure manager is the hub for everything in a campaign. It is
            divided into four collapsible panels: <strong>Players</strong>,
            <strong>Image Scenes</strong>, <strong>Encounters</strong>, and
            <strong>Playlists</strong>.
          </P>

          <H3>Players</H3>
          <P>
            Players are the persistent characters who appear in every encounter
            in this adventure. Add them once here; they are automatically
            included in the combatant roster when you run any encounter. AC,
            Passive Perception, and Spell Save DC will display persistentlyfor
            the GM if you enter them.
          </P>
          <FigureZoom
            src="/help/players.png"
            caption="Player Management (click to enlarge)"
          />
          <Ul>
            <Li>
              Click <strong>+ Add Player</strong> to create a new player.
            </Li>
            <Li>
              Fields: Name (required), Max HP (required), Initiative modifier,
              AC, Spell Save DC, Passive Perception, and a colour dot used on
              the player screen.
            </Li>
            <Li>
              Click a player row to edit it. Changes take effect immediately in
              any running encounter.
            </Li>
          </Ul>

          <H3>Image Scenes</H3>
          <P>
            Scenes group atmospheric artwork by location or mood. Clicking
            <strong>▶ Show</strong> on an image pushes it to the Player Screen
            instantly. You can attach a playlist to an image so that it starts
            automatically when the image is shown. The active image's button
            turns into <strong>■ Hide</strong> to let you clear the screen.
          </P>
          <Ul>
            <Li>
              Click <strong>+ Add Scene</strong> to create a named scene (e.g.
              <em>Tavern Interior</em>, <em>Boss Chamber</em>).
            </Li>
            <Li>
              Click <strong>Manage</strong> on a scene to expand it and add
              images.
            </Li>
            <Li>
              Click <strong>+ Add Images</strong> to upload one or more image
              files.
            </Li>
            <Li>
              Drag the <strong>⠿</strong> grip on any image tile to reorder
              images within a scene.
            </Li>
            <Li>
              Click the fit mode buttons (<em>Cover / Fit / Center</em>) below
              an image to control how it fills the player screen. Changing the
              mode on an image that is currently displayed updates the player
              screen immediately.
            </Li>
            <Li>
              Click <strong>🎵</strong> below an image to attach a playlist.
              That playlist starts automatically whenever you show the image.
            </Li>
          </Ul>
          <Tip>
            <strong>Cover</strong> fills the entire screen (may crop edges).
            <strong>Fit</strong> shows the full image with letterboxing.
            <strong>Center</strong> displays the image at its natural
            resolution, centred.
          </Tip>
          <Tip>
            <strong>Shift+click</strong> the Show or Hide button to crossfade
            the image in or out over 0.6 seconds instead of cutting instantly.
          </Tip>

          <H3>Encounters</H3>
          <P>
            Each encounter has its own combatant roster, drawn from the
            adventure players plus any NPCs, enemies, groups, or special entries
            you add.
          </P>
          <FigureZoom
            src="/help/encounters.png"
            caption="Encounter Management (click to enlarge)"
          />
          <Ul>
            <Li>
              Click <strong>+ Add Encounter</strong> to create one. Give it a
              name and optionally attach a playlist to play during combat.
            </Li>
            <Li>
              Click <strong>Manage</strong> to expand the combatant list and add
              or remove entries before running.
            </Li>
            <Li>
              Combatant types:
              <Ul>
                <Li>
                  <strong>PC</strong> — links to an adventure player (HP synced
                  automatically).
                </Li>
                <Li>
                  <strong>NPC / Enemy</strong> — a single creature with its own
                  HP and stat block.
                </Li>
                <Li>
                  <strong>Group</strong> — multiple monsters sharing a
                  initiative count (e.g. <em>3× Goblin</em>).  The group can be
                  expanded on the player screen to show each member's HP and conditions.
                  It is otherwise automatically expanded during that group's turn.  Clicking
                  on the name of a member in the group will allow you to rename it.
                </Li>
                <Li>
                  <strong>Event / Lair Action</strong> — non-creature entries
                  for initiative-order timing.
                </Li>
              </Ul>
            </Li>
            <Li>
              By default, Enemies and Groups are visible on the player screen,
              and Event and Lair Actions are not. Visibility of any entity can
              be toggled in the combatant list before or during the encounter.
            </Li>
            <Li>
              Click <strong>Open5e Search</strong> on any enemy or NPC to import
              its stat block directly from the
              <A href="https://open5e.com/">Open5e</A> monster database.
            </Li>
            <Li>
              Click <strong>▶ Run</strong> to open the encounter tracker.
            </Li>
          </Ul>
        </Section>

        {/* ── ENCOUNTER TRACKER ───────────────────────────────────── */}
        <Section id="encounter">
          <H2>Encounter Tracker</H2>
          <P>
            The encounter tracker is the GM-facing combat view. It manages
            initiative order, HP, conditions, and what the players see on their
            screen.
          </P>
          <FigureZoom
            src="/help/tracker.png"
            caption="Encounter Tracker (click to enlarge)"
          />
          <H3>Starting Combat</H3>
          <Ol>
            <OlLi>
              Click <strong>Roll All Initiative</strong> to roll d20 + modifier
              for every combatant, or click any initiative number to set it
              manually. This is the only roll available in the entire toolkit,
              because rolling shiny math rocks is fun.
            </OlLi>
            <OlLi>
              Click <strong>▶ Show on Player</strong> (in the Player Window
              menu) to push the tracker to the Player Screen. The Player Window
              menu also lets you toggle whether the initiative numbers and HP
              bars are visible to players.
            </OlLi>
            <OlLi>
              Use <strong>◀ ▶</strong> in the header to advance turns. The round
              counter increments when the order wraps around.
            </OlLi>
          </Ol>

          <H3>HP and Conditions</H3>
          <Ul>
            <Li>
              You can edit the hit points of any combatant in the tracker.
              Changes are reflected on the player screen in real time.
              <Ol>
                <OlLi>Click the hit point value to edit it directly</OlLi>
                <OlLi>
                  Click the red or green buttons to decrease/increase the HP by
                  that amount
                </OlLi>
                <OlLi>
                  Enter a value next to the DMG or HEAL buttons, and click DMG
                  to decrease HP by that amount, or HEAL to increase it.
                </OlLi>
              </Ol>
            </Li>
            <Li>
              Click the condition badge area 🩹 on any row to add or remove
              status conditions (Blinded, Charmed, Frightened, etc.). Conditions
              appear as coloured chips and are visible on the player screen.
              Bloodied will be applied automatically when a combatant's HP drops
              below half of its maximum.
            </Li>
            <Li>
              For creatures with legendary actions, the tracker shows a
              legendary action counter that resets each round.
            </Li>
            <Li>
              For creatures with legendary resistances, the tracker shows a
              legendary resistance counter.
            </Li>
          </Ul>

          <H3>Player Screen Controls</H3>
          <P>
            The <strong>Player Window</strong> menu in the header gives you
            fine-grained control over what the players see:
          </P>
          <Ul>
            <Li>
              <strong>Show/Hide Initiative</strong> — toggles whether the
              initiative order is visible on the player screen.
            </Li>
            <Li>
              <strong>Show/Hide HP</strong> — toggles whether HP bars appear on
              the player screen.
            </Li>
            <Li>
              <strong>Show on Player / Hide from Player</strong> — sends the
              full tracker to the player screen or removes it.
            </Li>
          </Ul>

          <H3>Stat Blocks</H3>
          <Ul>
            <Li>
              Click a combatant's name to open its stat block in a side panel
              (if one has been attached).
            </Li>
            <Li>
              Stat blocks imported from Open5e include full ability scores,
              actions, legendary actions, and resistances.
            </Li>
            <Li>
              There is an experimental feature to add/edit stat blocks when
              creating a combatant, as well.
            </Li>
          </Ul>

          <H3>Ending the Encounter</H3>
          <Ul>
            <Li>
              Click <strong>End Encounter</strong> to close the tracker and
              return to the adventure manager. Encounter progress is cleared.
            </Li>
            <Li>
              Click <strong>Reset</strong> to return all combatants to full HP
              and clear initiative without leaving the tracker.
            </Li>
            <Li>
              Navigating away mid-encounter automatically saves progress. When
              you run the encounter again, it resumes exactly where you left
              off.
            </Li>
          </Ul>

          <Tip>
            You can add combatants mid-encounter using the
            <strong>+ Add Combatant</strong> button. Temporary combatants exist
            only for the current run and are not saved back to the roster.
          </Tip>
        </Section>

        {/* ── PLAYLISTS & AUDIO ───────────────────────────────────── */}
        <Section id="audio">
          <H2>Playlists &amp; Audio</H2>
          <P>
            GM Assistant plays ambient audio through a persistent bar at the
            bottom of every GM page. Playlists belong to an adventure and can be
            attached to images or encounters to start automatically.
          </P>

          <H3>Creating Playlists and Adding Tracks</H3>
          <Ol>
            <OlLi>
              In the adventure manager or encounter editor, open the
              <strong>Playlists</strong> panel and click
              <strong>+ Add Playlist</strong>.
            </OlLi>
            <OlLi>
              Click <strong>Down Arrow</strong> on the playlist to expand it.
            </OlLi>
            <OlLi>
              Click <strong>+ Add Track</strong> and choose a source:
              <Ul>
                <Li>
                  <strong>YouTube</strong> — paste any YouTube video or playlist URL.
                  <Ol>
                    <OlLi>Use the YT button in the bottom Audio Bar to access features associated with your YouTube accounts,
                      such as playback without ads if you have a YouTube Premium subscription</OlLi>
                      <OlLi>YouTube audio is never downloaded, only played from YouTube in accordance with their terms of service.
                        You must be online to use YouTube audio tracks</OlLi>
                  </Ol>
                </Li>
                <Li>
                  <strong>Upload File</strong> — MP3, M4A, OGG, FLAC, WAV, Opus,
                  and most other common audio formats.
                </Li>
              </Ul>
            </OlLi>
            <OlLi>
              Drag the <strong>⠿</strong> grip to reorder tracks within the
              playlist.
            </OlLi>
          </Ol>

          <H3>Playing Audio</H3>
          <Ul>
            <Li>
              Click <strong>▶</strong> next to a playlist name to start playing
              it immediately.
            </Li>
            <Li>
              Attach a playlist to a scene image or encounter so it starts
              automatically when you show or run it.
            </Li>
            <Li>
              If you navigate to a scene or encounter whose playlist is already
              playing, the music continues uninterrupted.
            </Li>
          </Ul>

          <H3>Playlist Row Buttons</H3>
          <P>
            Each playlist in the drawer has a row of icon buttons on the right:
          </P>
          <Ul>
            <Li>
              <strong>↕ / 🔀</strong> — Toggle shuffle. Shows <strong>↕</strong> (grey) when playing in order; switches to <strong>🔀</strong> (gold) when shuffle is on. Your choice is saved per playlist.
            </Li>
            <Li>
              <strong>↺ / 🔁</strong> — Toggle loop. Shows <strong>↺</strong> (grey) when the playlist stops after the last track; switches to <strong>🔁</strong> (gold) when it will restart from the beginning. Your choice is saved per playlist.
            </Li>
            <Li>
              <strong>▶</strong> — Start playing this playlist immediately. Turns gold while it is the active playlist.
            </Li>
            <Li>
              <strong>▼ / ▲</strong> — Expand or collapse the track list. Gold when expanded.
            </Li>
            <Li>
              <strong>↓</strong> — Export the playlist as a <code>.gma.zip</code> file, including any uploaded audio files.
            </Li>
            <Li>
              <strong>🗑</strong> — Delete the playlist and all its tracks. Requires typing <code>DELETE</code> to confirm.
            </Li>
          </Ul>

          <H3>The Audio Bar</H3>
          <P>
            The bar pinned to the bottom of every GM page shows the
            currently-playing track, the playlist name, and playback controls.
          </P>
          <Ul>
            <Li>
              <strong>⏮ ⏭</strong> — skip to the previous or next track.
            </Li>
            <Li>
              <strong>⏸</strong> — pause / resume.
            </Li>
            <Li>
              <strong>⏹</strong> — stop and clear the current track.
            </Li>
            <Li>
              <strong>🔀</strong> — toggle shuffle. Gold when active; your
              preference is remembered per playlist.
            </Li>
            <Li>Click the playlist name to open the Playlists drawer.</Li>
          </Ul>

          <H3>Play Modes</H3>
          <P>Two settings combine to control how a playlist plays:</P>
          <Ul>
            <Li>
              <strong>Order (↕ / 🔀)</strong> — <strong>Sequential</strong> plays tracks top-to-bottom; <strong>Shuffle</strong> randomises the order each time. Toggled per playlist; saved automatically.
            </Li>
            <Li>
              <strong>Loop (↺ / 🔁)</strong> — when off, the playlist stops after the last track; when on, it starts over from the beginning (re-shuffling if shuffle is active). Toggled per playlist; saved automatically.
            </Li>
          </Ul>

          <Tip>
            YouTube playback requires an internet connection. All uploaded audio
            works offline in the desktop build.
          </Tip>
        </Section>

        {/* ── PLAYER SCREEN ───────────────────────────────────────── */}
        <Section id="player">
          <H2>Player Screen</H2>
          <P>
            The Player Screen is a separate browser window or display designed
            to be shown to your players on a second monitor, a TV, or a
            projector. It receives updates from the GM interface in real time
            via a broadcast channel — no refresh needed.
          </P>

          <H3>Opening the Player Screen</H3>
          <Ol>
            <OlLi>
              Click <strong>🖥 Player Window</strong> in the GM header.
            </OlLi>
            <OlLi>
              Select <strong>Open Player Screen</strong>. A new window opens at
              <code>/player</code>.
            </OlLi>
            <OlLi>
              Drag the window to your players' monitor and maximise or
              fullscreen it.
            </OlLi>
          </Ol>

          <H3>What Players See</H3>
          <Ul>
            <Li>
              <strong>Images</strong> — displayed when you click
              <strong>▶ Show</strong> on a scene image in the adventure manager.
            </Li>
            <Li>
              <strong>Initiative tracker</strong> — shown when you click
              <strong>Show on Player</strong> from the encounter tracker. It
              overlays the bottom of the screen over whatever image is currently
              displayed.
            </Li>
            <Li>
              <strong>HP bars</strong> — visible when Show HP is enabled in the
              encounter tracker controls.
            </Li>
            <Li>
              <strong>Conditions</strong> — condition chips appear under each
              combatant's name.
            </Li>
          </Ul>

          <H3>Controlling the Display</H3>
          <Ul>
            <Li>
              Click <strong>⬛ Blank Screen</strong> (in the Player Window menu)
              to clear the current image and hide the initiative tracker
              instantly.
            </Li>
            <Li>
              Changing the fit mode (Cover / Fit / Center) on an image that is
              currently showing updates the player screen immediately without
              re-sending the image.
            </Li>
          </Ul>

          <Tip>
            In the packaged desktop app, the Player Screen window automatically
            enters fullscreen when opened.
          </Tip>
        </Section>

        {/* ── DESKTOP APP ─────────────────────────────────────────── */}
        <Section id="desktop">
          <H2>Desktop App</H2>
          <P>
            The desktop build is a self-contained Electron application. It
            bundles the GM Assistant server and SQLite database so that the app
            runs entirely on your local machine — no server setup, no browser
            required.
          </P>

          <H3>What Works Offline</H3>
          <P>Everything works offline except:</P>
          <Ol>
            <OlLi>
              Stat block import from <A href="https://open5e.com/">Open5e</A>
              (requires internet to query the API).
            </OlLi>
            <OlLi>
              YouTube audio playback (streams from YouTube's servers).
            </OlLi>
          </Ol>

          <H3>Data and Updates</H3>
          <Ul>
            <Li>
              Your data is stored in your OS user-data folder. It persists
              across updates — installing a new version does not touch your
              campaigns.
            </Li>
            <Li>
              To update, download the latest installer from the releases page
              and run it over the existing installation.
            </Li>
          </Ul>
        </Section>

        {/* ── IMPORT & EXPORT ─────────────────────────────────────── */}
        <Section id="import">
          <H2>Import &amp; Export</H2>
          <P>
            Adventures and encounters can be packaged into <code>.gma.zip</code>
            files for backup, migration, or sharing with other GMs.
          </P>

          <H3>Exporting</H3>
          <Ul>
            <Li>
              On the home screen, click <strong>↓ Export Adventure</strong> on
              any adventure card to export the entire adventure (all scenes,
              encounters, playlists, and uploaded audio).
            </Li>
            <Li>
              From inside an adventure, click
              <strong>↓ Export Encounter</strong> to export a single encounter,
              including its combatant roster and stat blocks.
            </Li>
          </Ul>

          <H3>Importing</H3>
          <Ul>
            <Li>
              On the home screen, click <strong>↑ Import Adventure</strong> to
              restore an exported adventure archive.
            </Li>
            <Li>
              From inside an adventure, click
              <strong>↑ Import Encounter</strong> to add a previously exported
              encounter to the current adventure.
            </Li>
          </Ul>

          <Tip>
            Exported archives include uploaded audio files, so they can be
            large. YouTube links are stored by URL and do not add to the archive
            size.
          </Tip>

          <P>
            See also: <SiteLink to="/about">About page</SiteLink> for a full
            technical overview.
          </P>
        </Section>
      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#1a1a2e",
    color: "#e0e0e0",
    paddingBottom: 80,
  },
  title: { margin: 0, fontSize: "1.4rem", color: "#c9a84c" },
  main: { maxWidth: 860, margin: "0 auto", padding: "40px 24px" },

  section: { marginBottom: 56, scrollMarginTop: 80 },

  h2: {
    margin: "0 0 16px",
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#c9a84c",
    borderBottom: "1px solid #2a2a4a",
    paddingBottom: 8,
  },

  h3: {
    margin: "24px 0 8px",
    fontSize: "0.825rem",
    fontWeight: 700,
    color: "#a08040",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  p: {
    margin: "0 0 12px",
    fontSize: "0.925rem",
    lineHeight: 1.75,
    color: "#ccc",
  },

  lead: {
    margin: "0 0 32px",
    fontSize: "1.05rem",
    lineHeight: 1.8,
    color: "#bbb",
    borderLeft: "3px solid #c9a84c",
    paddingLeft: 16,
  },

  ul: { margin: "0 0 12px", padding: 0, listStyle: "none" },
  ol: { margin: "0 0 12px", padding: 0, listStyle: "none" },

  li: {
    display: "flex",
    gap: 10,
    alignItems: "baseline",
    marginBottom: 8,
    fontSize: "0.925rem",
    lineHeight: 1.65,
    color: "#ccc",
  },

  bullet: {
    color: "#c9a84c",
    fontSize: "0.45rem",
    flexShrink: 0,
    marginTop: "0.55em",
  },

  olNumber: {
    color: "#c9a84c",
    fontSize: "0.8rem",
    fontWeight: 700,
    flexShrink: 0,
    minWidth: "1.4em",
    textAlign: "right",
  },

  a: {
    color: "#c9a84c",
    textDecoration: "underline",
    textDecorationColor: "#c9a84c55",
    textUnderlineOffset: "3px",
    cursor: "pointer",
  },

  tip: {
    display: "flex",
    gap: 10,
    alignItems: "baseline",
    margin: "12px 0",
    padding: "10px 14px",
    background: "#1e2a1a",
    border: "1px solid #3a5a2a",
    borderLeft: "3px solid #6aaf50",
    borderRadius: 4,
    fontSize: "0.875rem",
    lineHeight: 1.65,
    color: "#aad090",
  },

  tipIcon: { flexShrink: 0, fontSize: "0.9rem" },

  figure: { margin: "24px 0", padding: 0 },
  figImg: {
    display: "block",
    maxWidth: "100%",
    borderRadius: 6,
    border: "1px solid #2a2a4a",
  },
  figCaption: {
    marginTop: 8,
    fontSize: "0.8rem",
    color: "#666",
    fontStyle: "italic",
  },

  figThumbBtn: {
    display: "block",
    background: "none",
    border: "1px solid #2a2a4a",
    borderRadius: 6,
    padding: 0,
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden",
    maxWidth: "100%",
  },
  figThumb: {
    display: "block",
    maxWidth: "100%",
    maxHeight: 220,
    objectFit: "contain" as const,
    borderRadius: 5,
  },
  figZoomHint: {
    position: "absolute" as const,
    bottom: 6,
    right: 8,
    fontSize: "0.7rem",
    color: "#c9a84c",
    background: "rgba(0,0,0,0.65)",
    padding: "2px 7px",
    borderRadius: 10,
    pointerEvents: "none" as const,
  },

  lightboxBackdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  lightboxContent: {
    position: "relative" as const,
    maxWidth: "90vw",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 12,
  },
  lightboxImg: {
    maxWidth: "90vw",
    maxHeight: "80vh",
    objectFit: "contain" as const,
    borderRadius: 8,
    border: "1px solid #3a3a5a",
    display: "block",
  },
  lightboxCaption: {
    color: "#aaa",
    fontSize: "0.85rem",
    fontStyle: "italic",
    margin: 0,
    textAlign: "center" as const,
  },
  lightboxClose: {
    position: "absolute" as const,
    top: -14,
    right: -14,
    background: "#1a1a2e",
    border: "1px solid #3a3a5a",
    color: "#aaa",
    borderRadius: "50%",
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },

  toc: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 48,
    padding: "14px 16px",
    background: "#16213e",
    border: "1px solid #2a2a4a",
    borderRadius: 6,
  },

  tocLink: {
    color: "#c9a84c",
    textDecoration: "none",
    fontSize: "0.825rem",
    padding: "3px 10px",
    border: "1px solid #2a2a4a",
    borderRadius: 12,
    whiteSpace: "nowrap",
  },
};
