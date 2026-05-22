import { useRouterState } from '@tanstack/react-router';
import { useAudio } from '../hooks/useAudio';

export function AudioBar() {
  const { currentPathname } = useRouterState({
    select: (s) => ({ currentPathname: s.location.pathname }),
  });

  const { currentPlaylist, currentTrackIndex, isPlaying, volume, pause, resume, stop, nextTrack, prevTrack, setVolume } = useAudio();

  if (currentPathname === '/player') return null;

  const track = currentPlaylist?.tracks[currentTrackIndex];

  return (
    <div style={bar}>
      <div style={left}>
        {currentPlaylist ? (
          <>
            <span style={playlistName}>{currentPlaylist.name}</span>
            <span style={trackName}>{track?.name ?? '—'}</span>
          </>
        ) : (
          <span style={idleText}>No audio playing</span>
        )}
      </div>
      <div style={controls}>
        <button style={btn} onClick={prevTrack} disabled={!currentPlaylist} title="Previous track">⏮</button>
        {isPlaying ? (
          <button style={btn} onClick={pause} disabled={!currentPlaylist} title="Pause">⏸</button>
        ) : (
          <button style={btn} onClick={resume} disabled={!currentPlaylist} title="Play">▶</button>
        )}
        <button style={{ ...btn, color: '#ef5350' }} onClick={stop} disabled={!currentPlaylist} title="Stop">⏹</button>
        <button style={btn} onClick={nextTrack} disabled={!currentPlaylist} title="Next track">⏭</button>
      </div>
      <div style={volWrap}>
        <span style={volLabel}>🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ width: 80, accentColor: '#c9a84c' }}
        />
        <span style={volLabel}>{volume}</span>
      </div>
    </div>
  );
}

const bar: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: 48,
  background: '#0d0d1f',
  borderTop: '1px solid #2a2a4a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 20px',
  gap: 16,
  zIndex: 1000,
  fontSize: '0.8rem',
};

const left: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
  overflow: 'hidden',
};

const playlistName: React.CSSProperties = {
  color: '#c9a84c',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const trackName: React.CSSProperties = {
  color: '#888',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '0.72rem',
};

const idleText: React.CSSProperties = { color: '#555', fontStyle: 'italic' };

const controls: React.CSSProperties = { display: 'flex', gap: 4 };

const btn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #333',
  color: '#ccc',
  width: 32,
  height: 32,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const volWrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
const volLabel: React.CSSProperties = { color: '#666', minWidth: 24, textAlign: 'center' };
