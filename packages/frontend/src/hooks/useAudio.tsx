import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface PlaylistTrack {
  id: number;
  playlistId: number;
  name: string;
  type: 'file' | 'youtube';
  url: string;
  sortOrder: number;
  volume: number;
}

export interface Playlist {
  loop: boolean;
  id: number;
  adventureId: number;
  name: string;
  sortOrder: number;
  playMode: PlayMode;
  volume: number;
  tracks: PlaylistTrack[];
}

export type PlayMode = 'sequential' | 'shuffle';

interface AudioState {
  currentPlaylist: Playlist | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  playMode: PlayMode;
  ytVisible: boolean;
  currentTime: number;
  duration: number;
  ambientPlaylist: Playlist | null;
  ambientTrackIndex: number;
  ambientIsPlaying: boolean;
  ambientVolume: number;
}

interface AudioContextValue extends AudioState {
  playPlaylist: (playlist: Playlist, trackIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (v: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  setYtVisible: (v: boolean) => void;
  seekTo: (t: number) => void;
  playAmbientPlaylist: (playlist: Playlist) => void;
  pauseAmbient: () => void;
  resumeAmbient: () => void;
  stopAmbient: () => void;
  setAmbientVolume: (v: number) => void;
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
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

function curveVolume(v: number): number {
  return (v / 100) ** 2 * 100;
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function buildPlayOrder(trackCount: number, mode: PlayMode, startIndex: number, pinStart = false): { order: number[]; pos: number } {
  if (mode === 'sequential') {
    return { order: Array.from({ length: trackCount }, (_, i) => i), pos: startIndex };
  }
  const all = Array.from({ length: trackCount }, (_, i) => i);
  if (pinStart) {
    const rest = all.filter((i) => i !== startIndex);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return { order: [startIndex, ...rest], pos: 0 };
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { order: all, pos: 0 };
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>({
    currentPlaylist: null,
    currentTrackIndex: 0,
    isPlaying: false,
    volume: Number(localStorage.getItem('gma:audio:volume') ?? '30'),
    playMode: (localStorage.getItem('gma:audio:playMode') as PlayMode | null) ?? 'sequential',
    ytVisible: false,
    currentTime: 0,
    duration: 0,
    ambientPlaylist: null,
    ambientTrackIndex: 0,
    ambientIsPlaying: false,
    ambientVolume: Number(localStorage.getItem('gma:audio:ambientVolume') ?? '20'),
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Main player refs ──────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytReadyRef = useRef(false);
  const pendingVideoRef = useRef<string | null>(null);
  const pendingTrackVolumeRef = useRef<number>(100);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playOrderRef = useRef<number[]>([]);
  const playPosRef = useRef<number>(0);

  // ── Ambient player refs ───────────────────────────────────────────────────
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientYtPlayerRef = useRef<YTPlayer | null>(null);
  const ambientYtReadyRef = useRef(false);
  const ambientPendingVideoRef = useRef<string | null>(null);
  const ambientPendingTrackVolumeRef = useRef<number>(100);
  const ambientYtContainerRef = useRef<HTMLDivElement | null>(null);
  const ambientPlayOrderRef = useRef<number[]>([]);
  const ambientPlayPosRef = useRef<number>(0);

  // ── Main poll ─────────────────────────────────────────────────────────────
  function startPoll() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      let currentTime = 0;
      let duration = 0;
      if (audioRef.current) {
        currentTime = audioRef.current.currentTime;
        duration = isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;
      } else if (ytPlayerRef.current && ytReadyRef.current) {
        try {
          currentTime = ytPlayerRef.current.getCurrentTime() ?? 0;
          duration = ytPlayerRef.current.getDuration() ?? 0;
        } catch {}
      }
      setState((s) => ({ ...s, currentTime, duration }));
    }, 500);
  }

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // ── Main player helpers ───────────────────────────────────────────────────
  function advanceTrack() {
    const { currentPlaylist } = stateRef.current;
    if (!currentPlaylist) return;
    const nextPos = playPosRef.current + 1;
    if (nextPos < playOrderRef.current.length) {
      playPosRef.current = nextPos;
      playTrackInner(currentPlaylist, playOrderRef.current[nextPos]);
    } else if (currentPlaylist.loop) {
      const { order, pos } = buildPlayOrder(currentPlaylist.tracks.length, currentPlaylist.playMode ?? stateRef.current.playMode, 0);
      playOrderRef.current = order;
      playPosRef.current = pos;
      playTrackInner(currentPlaylist, order[pos]);
    } else {
      setState((s) => ({ ...s, isPlaying: false }));
    }
  }

  function onYtReady() {
    ytReadyRef.current = true;
    if (ytPlayerRef.current) ytPlayerRef.current.setVolume(curveVolume(stateRef.current.volume));
    if (pendingVideoRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(pendingVideoRef.current);
      pendingVideoRef.current = null;
      startPoll();
    }
  }

  function onYtStateChange(e: { data: number }) {
    if (e.data === window.YT?.PlayerState?.ENDED) advanceTrack();
    if (e.data === 1) { startPoll(); setState((s) => ({ ...s, isPlaying: true })); }
    if (e.data === 2) { stopPoll();  setState((s) => ({ ...s, isPlaying: false })); }
  }

  function stopMainAudio() {
    stopPoll();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.stopVideo(); } catch {} }
    pendingVideoRef.current = null;
  }

  function playTrackInner(playlist: Playlist, index: number) {
    const track = playlist.tracks[index];
    if (!track) return;
    stopMainAudio();
    const vol = track.volume ?? 100;
    localStorage.setItem('gma:audio:volume', String(vol));
    stateRef.current = { ...stateRef.current, volume: vol };
    setState((s) => ({ ...s, currentPlaylist: playlist, currentTrackIndex: index, volume: vol }));
    if (track.type === 'youtube') {
      const videoId = extractYouTubeId(track.url);
      if (!videoId) return;
      if (ytReadyRef.current && ytPlayerRef.current) {
        ytPlayerRef.current.setVolume(curveVolume(vol));
        ytPlayerRef.current.loadVideoById(videoId);
        startPoll();
      } else {
        pendingVideoRef.current = videoId;
      }
    } else {
      if (ytContainerRef.current) ytContainerRef.current.style.display = 'none';
      setState((s) => ({ ...s, ytVisible: false }));
      const audio = new Audio(track.url);
      audio.volume = curveVolume(vol) / 100;
      audio.play().catch(() => {});
      audio.onended = () => advanceTrack();
      audioRef.current = audio;
      startPoll();
      setState((s) => ({ ...s, isPlaying: true }));
    }
  }

  // ── Ambient player helpers ────────────────────────────────────────────────
  function advanceAmbientTrack() {
    const { ambientPlaylist } = stateRef.current;
    if (!ambientPlaylist) return;
    const nextPos = ambientPlayPosRef.current + 1;
    if (nextPos < ambientPlayOrderRef.current.length) {
      ambientPlayPosRef.current = nextPos;
      playAmbientTrackInner(ambientPlaylist, ambientPlayOrderRef.current[nextPos]);
    } else if (ambientPlaylist.loop) {
      const { order, pos } = buildPlayOrder(ambientPlaylist.tracks.length, ambientPlaylist.playMode ?? 'sequential', 0);
      ambientPlayOrderRef.current = order;
      ambientPlayPosRef.current = pos;
      playAmbientTrackInner(ambientPlaylist, order[pos]);
    } else {
      setState((s) => ({ ...s, ambientIsPlaying: false }));
    }
  }

  function onAmbientYtReady() {
    ambientYtReadyRef.current = true;
    if (ambientYtPlayerRef.current) ambientYtPlayerRef.current.setVolume(curveVolume(stateRef.current.ambientVolume));
    if (ambientPendingVideoRef.current && ambientYtPlayerRef.current) {
      ambientYtPlayerRef.current.loadVideoById(ambientPendingVideoRef.current);
      ambientPendingVideoRef.current = null;
    }
  }

  function onAmbientYtStateChange(e: { data: number }) {
    if (e.data === window.YT?.PlayerState?.ENDED) advanceAmbientTrack();
    if (e.data === 1) setState((s) => ({ ...s, ambientIsPlaying: true }));
    if (e.data === 2) setState((s) => ({ ...s, ambientIsPlaying: false }));
  }

  function stopAmbientAudio() {
    if (ambientAudioRef.current) { ambientAudioRef.current.pause(); ambientAudioRef.current.onended = null; ambientAudioRef.current = null; }
    if (ambientYtPlayerRef.current && ambientYtReadyRef.current) { try { ambientYtPlayerRef.current.stopVideo(); } catch {} }
    ambientPendingVideoRef.current = null;
  }

  function playAmbientTrackInner(playlist: Playlist, index: number) {
    const track = playlist.tracks[index];
    if (!track) return;
    stopAmbientAudio();
    const vol = track.volume ?? 100;
    localStorage.setItem('gma:audio:ambientVolume', String(vol));
    stateRef.current = { ...stateRef.current, ambientVolume: vol };
    setState((s) => ({ ...s, ambientPlaylist: playlist, ambientTrackIndex: index, ambientVolume: vol }));
    if (track.type === 'youtube') {
      const videoId = extractYouTubeId(track.url);
      if (!videoId) return;
      if (ambientYtReadyRef.current && ambientYtPlayerRef.current) {
        ambientYtPlayerRef.current.setVolume(curveVolume(vol));
        ambientYtPlayerRef.current.loadVideoById(videoId);
      } else {
        ambientPendingVideoRef.current = videoId;
      }
    } else {
      if (ambientYtContainerRef.current) ambientYtContainerRef.current.style.display = 'none';
      const audio = new Audio(track.url);
      audio.volume = curveVolume(vol) / 100;
      audio.play().catch(() => {});
      audio.onended = () => advanceAmbientTrack();
      ambientAudioRef.current = audio;
      setState((s) => ({ ...s, ambientIsPlaying: true }));
    }
  }

  // ── YT player setup ───────────────────────────────────────────────────────
  useEffect(() => {
    // Main YT container
    const mainWrapper = document.createElement('div');
    Object.assign(mainWrapper.style, {
      position: 'fixed', bottom: '58px', right: '20px',
      width: '320px', height: '180px', zIndex: '2000',
      background: '#000', borderRadius: '6px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      overflow: 'hidden', display: 'none',
    });
    const mainContainer = document.createElement('div');
    mainWrapper.appendChild(mainContainer);
    document.body.appendChild(mainWrapper);
    ytContainerRef.current = mainWrapper;

    // Ambient YT container (hidden — ambient video not shown)
    const ambientWrapper = document.createElement('div');
    Object.assign(ambientWrapper.style, {
      position: 'fixed', bottom: '-9999px', right: '-9999px',
      width: '1px', height: '1px', zIndex: '-1',
      overflow: 'hidden', display: 'block',
    });
    const ambientContainer = document.createElement('div');
    ambientWrapper.appendChild(ambientContainer);
    document.body.appendChild(ambientWrapper);
    ambientYtContainerRef.current = ambientWrapper;

    function createPlayers() {
      if (!ytPlayerRef.current) {
        ytPlayerRef.current = new window.YT.Player(mainContainer, {
          height: '180', width: '320',
          playerVars: { playsinline: 1, rel: 0, controls: 1 },
          events: { onReady: onYtReady, onStateChange: onYtStateChange },
        });
      }
      if (!ambientYtPlayerRef.current) {
        ambientYtPlayerRef.current = new window.YT.Player(ambientContainer, {
          height: '1', width: '1',
          playerVars: { playsinline: 1, rel: 0, controls: 0 },
          events: { onReady: onAmbientYtReady, onStateChange: onAmbientYtStateChange },
        });
      }
    }

    if (window.YT?.Player) {
      createPlayers();
    } else {
      window.onYouTubeIframeAPIReady = createPlayers;
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; }
      if (ambientYtPlayerRef.current) { ambientYtPlayerRef.current.destroy(); ambientYtPlayerRef.current = null; }
      ytReadyRef.current = false;
      ambientYtReadyRef.current = false;
      ytContainerRef.current = null;
      ambientYtContainerRef.current = null;
      if (document.body.contains(mainWrapper)) document.body.removeChild(mainWrapper);
      if (document.body.contains(ambientWrapper)) document.body.removeChild(ambientWrapper);
    };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────
  const playPlaylist = useCallback((playlist: Playlist, trackIndex = 0) => {
    if (playlist.tracks.length === 0) return;
    if (stateRef.current.currentPlaylist?.id === playlist.id) return;
    const vol = playlist.volume ?? 100;
    localStorage.setItem('gma:audio:volume', String(vol));
    stateRef.current = { ...stateRef.current, volume: vol };
    setState(s => ({ ...s, volume: vol }));
    const { order, pos } = buildPlayOrder(playlist.tracks.length, playlist.playMode ?? stateRef.current.playMode, trackIndex);
    playOrderRef.current = order;
    playPosRef.current = pos;
    playTrackInner(playlist, order[pos]);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.pauseVideo(); } catch {} }
    stopPoll();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.playVideo(); } catch {} }
    startPoll();
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  const stop = useCallback(() => {
    stopMainAudio();
    pendingVideoRef.current = null;
    setState((s) => ({ ...s, isPlaying: false, currentPlaylist: null, currentTime: 0, duration: 0 }));
  }, []);

  const nextTrack = useCallback(() => {
    const { currentPlaylist } = stateRef.current;
    if (!currentPlaylist) return;
    const nextPos = playPosRef.current + 1;
    if (nextPos < playOrderRef.current.length) {
      playPosRef.current = nextPos;
      playTrackInner(currentPlaylist, playOrderRef.current[nextPos]);
    }
  }, []);

  const prevTrack = useCallback(() => {
    const { currentPlaylist } = stateRef.current;
    if (!currentPlaylist) return;
    const prevPos = playPosRef.current - 1;
    if (prevPos >= 0) {
      playPosRef.current = prevPos;
      playTrackInner(currentPlaylist, playOrderRef.current[prevPos]);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    localStorage.setItem('gma:audio:volume', String(v));
    if (audioRef.current) audioRef.current.volume = curveVolume(v) / 100;
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.setVolume(curveVolume(v)); } catch {} }
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const seekTo = useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    if (ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.seekTo(t, true); } catch {} }
    setState((s) => ({ ...s, currentTime: t }));
  }, []);

  const setYtVisible = useCallback((v: boolean) => {
    if (ytContainerRef.current) ytContainerRef.current.style.display = v ? 'block' : 'none';
    setState((s) => ({ ...s, ytVisible: v }));
  }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    localStorage.setItem('gma:audio:playMode', mode);
    const { currentPlaylist, currentTrackIndex } = stateRef.current;
    if (currentPlaylist) {
      const { order, pos } = buildPlayOrder(currentPlaylist.tracks.length, mode, currentTrackIndex, true);
      playOrderRef.current = order;
      playPosRef.current = pos;
    }
    setState((s) => ({ ...s, playMode: mode }));
  }, []);

  const playAmbientPlaylist = useCallback((playlist: Playlist) => {
    if (playlist.tracks.length === 0) return;
    if (stateRef.current.ambientPlaylist?.id === playlist.id) return;
    const vol = playlist.volume ?? 100;
    localStorage.setItem('gma:audio:ambientVolume', String(vol));
    stateRef.current = { ...stateRef.current, ambientVolume: vol };
    setState(s => ({ ...s, ambientVolume: vol }));
    const { order, pos } = buildPlayOrder(playlist.tracks.length, playlist.playMode ?? 'sequential', 0);
    ambientPlayOrderRef.current = order;
    ambientPlayPosRef.current = pos;
    playAmbientTrackInner(playlist, order[pos]);
  }, []);

  const pauseAmbient = useCallback(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.pause();
    if (ambientYtPlayerRef.current && ambientYtReadyRef.current) { try { ambientYtPlayerRef.current.pauseVideo(); } catch {} }
    setState((s) => ({ ...s, ambientIsPlaying: false }));
  }, []);

  const resumeAmbient = useCallback(() => {
    if (ambientAudioRef.current) ambientAudioRef.current.play().catch(() => {});
    if (ambientYtPlayerRef.current && ambientYtReadyRef.current) { try { ambientYtPlayerRef.current.playVideo(); } catch {} }
    setState((s) => ({ ...s, ambientIsPlaying: true }));
  }, []);

  const stopAmbient = useCallback(() => {
    stopAmbientAudio();
    ambientPendingVideoRef.current = null;
    setState((s) => ({ ...s, ambientIsPlaying: false, ambientPlaylist: null, ambientTrackIndex: 0 }));
  }, []);

  const setAmbientVolume = useCallback((v: number) => {
    localStorage.setItem('gma:audio:ambientVolume', String(v));
    if (ambientAudioRef.current) ambientAudioRef.current.volume = curveVolume(v) / 100;
    if (ambientYtPlayerRef.current && ambientYtReadyRef.current) { try { ambientYtPlayerRef.current.setVolume(curveVolume(v)); } catch {} }
    setState((s) => ({ ...s, ambientVolume: v }));
  }, []);

  return (
    <AudioCtx.Provider value={{ ...state, playPlaylist, pause, resume, stop, nextTrack, prevTrack, setVolume, setPlayMode, setYtVisible, seekTo, playAmbientPlaylist, pauseAmbient, resumeAmbient, stopAmbient, setAmbientVolume }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
