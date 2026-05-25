import { Link } from '@tanstack/react-router';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useCurrentAdventure } from '../context/AdventureContext';
import { useBroadcastSender } from '../hooks/useBroadcast';
import { PlaylistDrawer } from './PlaylistDrawer';

export function GmHeader({
  children,
  wrap,
  rightSlot,
  playerMenuItems,
  onPlaylistChange,
}: {
  children: ReactNode;
  wrap?: boolean;
  rightSlot?: ReactNode;
  playerMenuItems?: ReactNode;
  onPlaylistChange?: () => void;
}) {
  const { adventureId } = useCurrentAdventure();
  const send = useBroadcastSender();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);
  const playerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPlayerMenu) return;
    function handleClick(e: MouseEvent) {
      if (playerMenuRef.current && !playerMenuRef.current.contains(e.target as Node)) {
        setShowPlayerMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPlayerMenu]);

  function blankScreen() {
    send({ type: 'CLEAR_IMAGE' });
    send({ type: 'TOGGLE_INITIATIVE', payload: { visible: false } });
    try {
      const raw = localStorage.getItem('gma:initiative');
      if (raw) localStorage.setItem('gma:initiative', JSON.stringify({ ...JSON.parse(raw), visible: false }));
    } catch {}
  }

  return (
    <>
      <header style={{ ...header, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
        <Link to="/" style={brand} title="GM Assistant — Home">
          <img src="/logo.png" alt="GM Assistant" style={logo} />
        </Link>
        {children}
        <div style={rightGroup}>
          {rightSlot}
          {adventureId != null && (
            <button
              type="button"
              style={{ ...persistBtn, ...(showPlaylists ? persistBtnActive : {}) }}
              onClick={() => setShowPlaylists((v) => !v)}
              title="Playlists"
            >
              🎵 Playlists
            </button>
          )}

          {/* Player Window split button */}
          <div ref={playerMenuRef} style={splitWrap}>
            <button
              type="button"
              style={{ ...splitMain, ...(showPlayerMenu ? persistBtnActive : {}) }}
              onClick={() => setShowPlayerMenu((v) => !v)}
              title="Player window controls"
            >
              🖥 Player Window ▾
            </button>
            {showPlayerMenu && (
              <div style={dropdown}>
                <button type="button" style={dropItem}
                  onClick={() => { window.open('/player', 'gmassisstant-player', 'width=1920,height=1080'); setShowPlayerMenu(false); }}
                >
                  🖥 Open Player Screen
                </button>
                <button type="button" style={{ ...dropItem, color: '#ef5350' }}
                  onClick={() => { blankScreen(); setShowPlayerMenu(false); }}
                >
                  ⬛ Blank Screen
                </button>
                {playerMenuItems && (
                  <>
                    <div style={divider} />
                    {playerMenuItems}
                  </>
                )}
              </div>
            )}
          </div>

          <Link to="/about" style={helpLink} title="About">i</Link>
          <Link to="/help" style={helpLink} title="Help">?</Link>
        </div>
      </header>

      {adventureId != null && showPlaylists && (
        <PlaylistDrawer
          adventureId={adventureId}
          onClose={() => setShowPlaylists(false)}
          onInvalidate={onPlaylistChange}
        />
      )}
    </>
  );
}

// Exported for use in dropdown menu items passed by pages.
export const dropdownItem: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '7px 14px',
  background: 'none',
  border: 'none',
  borderRadius: 0,
  color: '#e0e0e0',
  fontSize: '0.825rem',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const dropdownItemActive: React.CSSProperties = {
  ...dropdownItem,
  color: '#4caf50',
};

const header: React.CSSProperties = {
  padding: '12px 32px',
  borderBottom: '1px solid #2a2a4a',
  background: '#16213e',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
};

const brand: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
};

const logo: React.CSSProperties = {
  height: 36,
  width: 36,
  borderRadius: 6,
  objectFit: 'contain',
};

const rightGroup: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const persistBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#c9a84c',
  border: '1px solid #c9a84c',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.825rem',
  whiteSpace: 'nowrap',
};

const persistBtnActive: React.CSSProperties = {
  background: '#c9a84c',
  color: '#1a1a2e',
};

const splitWrap: React.CSSProperties = {
  position: 'relative',
};

const splitMain: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#c9a84c',
  border: '1px solid #c9a84c',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.825rem',
  whiteSpace: 'nowrap',
};

const dropdown: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  background: '#16213e',
  border: '1px solid #2a2a4a',
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  zIndex: 200,
  minWidth: 200,
  padding: '4px 0',
};

const dropItem: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '7px 14px',
  background: 'none',
  border: 'none',
  borderRadius: 0,
  color: '#e0e0e0',
  fontSize: '0.825rem',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const divider: React.CSSProperties = {
  height: 1,
  background: '#2a2a4a',
  margin: '4px 0',
};

const helpLink: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid #3a3a5a',
  background: 'transparent',
  color: '#888',
  fontSize: '0.95rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  lineHeight: 1,
};
