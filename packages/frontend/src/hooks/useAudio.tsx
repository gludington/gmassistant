import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface PlaylistTrack {
  id: number;
  playlistId: number;
  name: string;
  type: 'file' | 'youtube';
  url: string;
  sortOrder: number;
}

export interface Playlist {
  id: number;
  adventureId: number;
  name: string;
  sortOrder: number;
  tracks: PlaylistTrack[];
}

interface AudioState {
  currentPlaylist: Playlist | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
}

interface AudioContextValue extends AudioState {
  playPlaylist: (playlist: Playlist, trackIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (v: number) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: object) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  setVolume(v: number): void;
  destroy(): void;
  loadVideoById(id: string): void;
}

// Applies a quadratic curve so low slider values map to genuinely quiet levels.
// Slider 0-100 → YouTube/HTML5 0-100 (but curved).
function curveVolume(v: number): number {
  return (v / 100) ** 2 * 100;
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>({
    currentPlaylist: null,
    currentTrackIndex: 0,
    isPlaying: false,
    volume: Number(localStorage.getItem('gma:audio:volume') ?? '30'),
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  // true only after onReady fires — safe to call API methods
  const ytReadyRef = useRef(false);
  // video to play as soon as the player becomes ready
  const pendingVideoRef = useRef<string | null>(null);

  function advanceTrack() {
    const { currentPlaylist, currentTrackIndex } = stateRef.current;
    if (!currentPlaylist) return;
    const next = currentTrackIndex + 1;
    if (next < currentPlaylist.tracks.length) {
      playTrackInner(currentPlaylist, next);
    } else {
      setState((s) => ({ ...s, isPlaying: false }));
    }
  }

  function onYtReady() {
    ytReadyRef.current = true;
    if (ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(curveVolume(stateRef.current.volume));
    }
    if (pendingVideoRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(pendingVideoRef.current);
      pendingVideoRef.current = null;
    }
  }

  function onYtStateChange(e: { data: number }) {
    if (e.data === window.YT?.PlayerState?.ENDED) advanceTrack();
    if (e.data === 1 /* PLAYING */) setState((s) => ({ ...s, isPlaying: true }));
    if (e.data === 2 /* PAUSED */)  setState((s) => ({ ...s, isPlaying: false }));
  }

  useEffect(() => {
    // Create container imperatively so React never reconciles it
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed', bottom: '60px', right: '20px',
      width: '320px', height: '180px', zIndex: '2000',
      background: '#000', borderRadius: '6px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      overflow: 'hidden',
    });
    document.body.appendChild(container);

    function createPlayer() {
      if (ytPlayerRef.current) return;
      ytPlayerRef.current = new window.YT.Player(container, {
        height: '180',
        width: '320',
        playerVars: { playsinline: 1, rel: 0, controls: 1 },
        events: {
          onReady: onYtReady,
          onStateChange: onYtStateChange,
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; }
      ytReadyRef.current = false;
      if (document.body.contains(container)) document.body.removeChild(container);
    };
  }, []);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try { ytPlayerRef.current.stopVideo(); } catch {}
    }
  }

  function playTrackInner(playlist: Playlist, index: number) {
    const track = playlist.tracks[index];
    if (!track) return;
    stopAudio();
    setState((s) => ({ ...s, currentPlaylist: playlist, currentTrackIndex: index }));

    if (track.type === 'youtube') {
      const videoId = extractYouTubeId(track.url);
      if (!videoId) return;
      if (ytReadyRef.current && ytPlayerRef.current) {
        ytPlayerRef.current.setVolume(curveVolume(stateRef.current.volume));
        ytPlayerRef.current.loadVideoById(videoId);
      } else {
        // Player not ready yet — play as soon as onReady fires
        pendingVideoRef.current = videoId;
      }
    } else {
      const audio = new Audio(track.url);
      audio.volume = stateRef.current.volume / 100;
      audio.play().catch(() => {});
      audio.onended = () => advanceTrack();
      audioRef.current = audio;
      setState((s) => ({ ...s, isPlaying: true }));
    }
  }

  const playPlaylist = useCallback((playlist: Playlist, trackIndex = 0) => {
    if (playlist.tracks.length === 0) return;
    playTrackInner(playlist, trackIndex);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.pauseVideo(); } catch {} }
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) { audioRef.current.play().catch(() => {}); }
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.playVideo(); } catch {} }
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  const stop = useCallback(() => {
    stopAudio();
    pendingVideoRef.current = null;
    setState((s) => ({ ...s, isPlaying: false, currentPlaylist: null }));
  }, []);

  const nextTrack = useCallback(() => {
    const { currentPlaylist, currentTrackIndex } = stateRef.current;
    if (!currentPlaylist) return;
    const next = currentTrackIndex + 1;
    if (next < currentPlaylist.tracks.length) playTrackInner(currentPlaylist, next);
  }, []);

  const prevTrack = useCallback(() => {
    const { currentPlaylist, currentTrackIndex } = stateRef.current;
    if (!currentPlaylist) return;
    const prev = currentTrackIndex - 1;
    if (prev >= 0) playTrackInner(currentPlaylist, prev);
  }, []);

  const setVolume = useCallback((v: number) => {
    localStorage.setItem('gma:audio:volume', String(v));
    if (audioRef.current) audioRef.current.volume = curveVolume(v) / 100;
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.setVolume(curveVolume(v)); } catch {} }
    setState((s) => ({ ...s, volume: v }));
  }, []);

  return (
    <AudioCtx.Provider value={{ ...state, playPlaylist, pause, resume, stop, nextTrack, prevTrack, setVolume }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
