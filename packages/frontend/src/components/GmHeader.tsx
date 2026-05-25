import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useCurrentAdventure } from '../context/AdventureContext';
import { useBroadcastSender } from '../hooks/useBroadcast';
import { PlaylistDrawer } from './PlaylistDrawer';

export function GmHeader({
  children,
  wrap,
  rightSlot,
  onPlaylistChange,
}: {
  children: ReactNode;
  wrap?: boolean;
  rightSlot?: ReactNode;
  onPlaylistChange?: () => void;
}) {
  const { adventureId } = useCurrentAdventure();
  const send = useBroadcastSender();
  const [showPlaylists, setShowPlaylists] = useState(false);

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
          <button type="button" style={blankBtn} onClick={blankScreen} title="Blank player screen">
            Blank Screen
          </button>
          <button
            type="button"
            style={persistBtn}
            onClick={() => window.open('/player', 'gmassisstant-player', 'width=1920,height=1080')}
            title="Open player screen"
          >
            Player Screen
          </button>
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

const blankBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#ef5350',
  border: '1px solid #ef5350',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.825rem',
  whiteSpace: 'nowrap',
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
