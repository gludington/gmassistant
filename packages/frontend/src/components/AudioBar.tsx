import { useRouterState } from '@tanstack/react-router';
import { useAudio } from '../hooks/useAudio';

export function AudioBar() {
  const { currentPathname } = useRouterState({
    select: (s) => ({ currentPathname: s.location.pathname }),
  });

  const { currentPlaylist, currentTrackIndex, isPlaying, volume, playMode, ytVisible, currentTime, duration, pause, resume, stop, nextTrack, prevTrack, setVolume, setPlayMode, setYtVisible, seekTo } = useAudio();

  if (currentPathname === '/player') return null;

  const track = currentPlaylist?.tracks[currentTrackIndex];
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
  }

  return (
    <div style={bar}>
      <div style={progressTrack} onClick={handleProgressClick}>
        <div style={{ ...progressFill, width: `${pct}%` }} />
      </div>
      <div style={left}>
        {currentPlaylist ? (
          <>
            <span style={playlistName}>{currentPlaylist.name}</span>
            <span style={trackName}>
              {track?.name ?? '—'}
              {duration > 0 && (
                <span style={timeText}> · {fmt(currentTime)} / {fmt(duration)}</span>
              )}
            </span>
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
        <button
          style={{ ...btn, color: playMode === 'shuffle' ? '#c9a84c' : '#555', borderColor: playMode === 'shuffle' ? '#c9a84c' : '#333' }}
          onClick={() => setPlayMode(playMode === 'shuffle' ? 'sequential' : 'shuffle')}
          title={playMode === 'shuffle' ? 'Shuffle on — click for sequential' : 'Sequential — click for shuffle'}
        >
          🔀
        </button>
        {track?.type === 'youtube' && (
          <button
            style={{ ...btn, color: ytVisible ? '#c9a84c' : '#555', borderColor: ytVisible ? '#c9a84c' : '#333' }}
            onClick={() => setYtVisible(!ytVisible)}
            title={ytVisible ? 'Hide video' : 'Show video'}
          >
            📺
          </button>
        )}
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

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
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

const progressTrack: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 4,
  background: '#1e1e35',
  cursor: 'pointer',
};

const progressFill: React.CSSProperties = {
  height: '100%',
  background: '#c9a84c',
  transition: 'width 0.5s linear',
  pointerEvents: 'none',
};

const timeText: React.CSSProperties = {
  color: '#666',
  fontSize: '0.7rem',
};
