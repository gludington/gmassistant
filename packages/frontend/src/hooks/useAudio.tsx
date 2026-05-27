import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface PlaylistTrack {
  id: number;
  playlistId: number;
  name: string;
  type: 'file' | 'youtube' | 'spotify';
  url: string;
  sortOrder: number;
}

export interface Playlist {
  loop: boolean;
  id: number;
  adventureId: number;
  name: string;
  sortOrder: number;
  playMode: PlayMode;
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
  spotifyVisible: boolean;
  currentTime: number;
  duration: number;
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
  setSpotifyVisible: (v: boolean) => void;
  seekTo: (t: number) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: object) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady: () => void;
    onSpotifyIframeApiReady: (api: SpotifyIFrameApi) => void;
  }
}

interface SpotifyIFrameApi {
  createController(
    element: HTMLElement,
    options: { uri?: string; width?: number | string; height?: number | string },
    callback: (controller: SpotifyController) => void
  ): void;
}

interface SpotifyController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(positionMs: number): void;
  destroy(): void;
  addListener(event: 'playback_update', cb: (e: { data: { isPaused: boolean; position: number; duration: number } }) => void): void;
  addListener(event: string, cb: (...args: unknown[]) => void): void;
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

// Applies a quadratic curve so low slider values map to genuinely quiet levels.
// Slider 0-100 → YouTube/HTML5 0-100 (but curved).
function curveVolume(v: number): number {
  return (v / 100) ** 2 * 100;
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function extractSpotifyUri(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  if (url.startsWith('spotify:')) return url;
  return null;
}

function buildPlayOrder(trackCount: number, mode: PlayMode, startIndex: number): { order: number[]; pos: number } {
  if (mode === 'sequential') {
    return { order: Array.from({ length: trackCount }, (_, i) => i), pos: startIndex };
  }
  const rest = Array.from({ length: trackCount }, (_, i) => i).filter(i => i !== startIndex);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return { order: [startIndex, ...rest], pos: 0 };
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>({
    currentPlaylist: null,
    currentTrackIndex: 0,
    isPlaying: false,
    volume: Number(localStorage.getItem('gma:audio:volume') ?? '30'),
    playMode: (localStorage.getItem('gma:audio:playMode') as PlayMode | null) ?? 'sequential',
    ytVisible: false,
    spotifyVisible: false,
    currentTime: 0,
    duration: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytReadyRef = useRef(false);
  const pendingVideoRef = useRef<string | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spotifyApiRef = useRef<SpotifyIFrameApi | null>(null);
  const spotifyControllerRef = useRef<SpotifyController | null>(null);
  const spotifyContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingSpotifyUriRef = useRef<string | null>(null);
  // guard: prevent advanceTrack firing multiple times per track end
  const spotifyEndedRef = useRef(false);

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
      // Spotify position is pushed via playback_update events, not polled
      setState((s) => ({ ...s, currentTime, duration }));
    }, 500);
  }

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // play order: array of track indices; playPosRef is current position within it
  const playOrderRef = useRef<number[]>([]);
  const playPosRef = useRef<number>(0);

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
    if (ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(curveVolume(stateRef.current.volume));
    }
    if (pendingVideoRef.current && ytPlayerRef.current) {
      if (ytContainerRef.current) ytContainerRef.current.style.display = 'block';
      setState((s) => ({ ...s, ytVisible: true }));
      ytPlayerRef.current.loadVideoById(pendingVideoRef.current);
      pendingVideoRef.current = null;
      startPoll();
    }
  }

  function onYtStateChange(e: { data: number }) {
    if (e.data === window.YT?.PlayerState?.ENDED) advanceTrack();
    if (e.data === 1 /* PLAYING */) { startPoll(); setState((s) => ({ ...s, isPlaying: true })); }
    if (e.data === 2 /* PAUSED */)  { stopPoll();  setState((s) => ({ ...s, isPlaying: false })); }
  }

  function createSpotifyController(uri: string) {
    const api = spotifyApiRef.current;
    const container = spotifyContainerRef.current;
    if (!api || !container) return;

    if (spotifyControllerRef.current) {
      spotifyEndedRef.current = false;
      spotifyControllerRef.current.loadUri(uri);
      spotifyControllerRef.current.play();
      setState((s) => ({ ...s, isPlaying: true }));
      return;
    }

    const inner = document.createElement('div');
    container.appendChild(inner);
    api.createController(inner, { uri, width: 320, height: 152 }, (ctrl) => {
      spotifyControllerRef.current = ctrl;
      spotifyEndedRef.current = false;
      ctrl.addListener('playback_update', (e) => {
        const { isPaused, position, duration } = e.data;
        setState((s) => ({ ...s, currentTime: position / 1000, duration: duration / 1000, isPlaying: !isPaused }));
        if (!isPaused && duration > 0 && position >= duration - 500 && !spotifyEndedRef.current) {
          spotifyEndedRef.current = true;
          advanceTrack();
        }
        if (isPaused) spotifyEndedRef.current = false;
      });
      ctrl.play();
      setState((s) => ({ ...s, isPlaying: true }));
    });
  }

  useEffect(() => {
    // Wrapper stays in the DOM (ytContainerRef); YT API replaces the inner
    // target div with an iframe, so we must keep them separate.
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'fixed', bottom: '58px', right: '20px',
      width: '320px', height: '180px', zIndex: '2000',
      background: '#000', borderRadius: '6px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      overflow: 'hidden',
      display: 'none',
    });
    const container = document.createElement('div');
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);
    ytContainerRef.current = wrapper;

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

    // ── Spotify Iframe API ────────────────────────────────────────────────────
    const spotifyWrapper = document.createElement('div');
    Object.assign(spotifyWrapper.style, {
      position: 'fixed', bottom: '58px', right: '20px',
      width: '320px', height: '152px', zIndex: '2000',
      borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      display: 'none',
    });
    document.body.appendChild(spotifyWrapper);
    spotifyContainerRef.current = spotifyWrapper;

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      spotifyApiRef.current = IFrameAPI;
      if (pendingSpotifyUriRef.current) {
        createSpotifyController(pendingSpotifyUriRef.current);
        pendingSpotifyUriRef.current = null;
      }
    };

    if (!document.getElementById('spotify-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'spotify-iframe-api';
      tag.src = 'https://open.spotify.com/embed/iframe-api/v1';
      document.head.appendChild(tag);
    }

    return () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; }
      ytReadyRef.current = false;
      ytContainerRef.current = null;
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      if (spotifyControllerRef.current) { try { spotifyControllerRef.current.destroy(); } catch {} spotifyControllerRef.current = null; }
      spotifyContainerRef.current = null;
      if (document.body.contains(spotifyWrapper)) document.body.removeChild(spotifyWrapper);
    };
  }, []);

  function stopAudio() {
    stopPoll();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try { ytPlayerRef.current.stopVideo(); } catch {}
    }
    if (spotifyControllerRef.current) {
      try { spotifyControllerRef.current.pause(); } catch {}
    }
  }

  function playTrackInner(playlist: Playlist, index: number) {
    const track = playlist.tracks[index];
    if (!track) return;
    stopAudio();
    setState((s) => ({ ...s, currentPlaylist: playlist, currentTrackIndex: index }));

    if (track.type === 'youtube') {
      if (spotifyContainerRef.current) spotifyContainerRef.current.style.display = 'none';
      setState((s) => ({ ...s, spotifyVisible: false }));
      const videoId = extractYouTubeId(track.url);
      if (!videoId) return;
      if (ytContainerRef.current) ytContainerRef.current.style.display = 'block';
      setState((s) => ({ ...s, ytVisible: true }));
      if (ytReadyRef.current && ytPlayerRef.current) {
        ytPlayerRef.current.setVolume(curveVolume(stateRef.current.volume));
        ytPlayerRef.current.loadVideoById(videoId);
        startPoll();
      } else {
        pendingVideoRef.current = videoId;
      }
    } else if (track.type === 'spotify') {
      if (ytContainerRef.current) ytContainerRef.current.style.display = 'none';
      setState((s) => ({ ...s, ytVisible: false }));
      const uri = extractSpotifyUri(track.url);
      if (!uri) return;
      if (spotifyContainerRef.current) spotifyContainerRef.current.style.display = 'block';
      setState((s) => ({ ...s, spotifyVisible: true }));
      if (spotifyApiRef.current) {
        createSpotifyController(uri);
      } else {
        pendingSpotifyUriRef.current = uri;
      }
    } else {
      if (ytContainerRef.current) ytContainerRef.current.style.display = 'none';
      setState((s) => ({ ...s, ytVisible: false }));
      if (spotifyContainerRef.current) spotifyContainerRef.current.style.display = 'none';
      setState((s) => ({ ...s, spotifyVisible: false }));
      const audio = new Audio(track.url);
      audio.volume = stateRef.current.volume / 100;
      audio.play().catch(() => {});
      audio.onended = () => advanceTrack();
      audioRef.current = audio;
      startPoll();
      setState((s) => ({ ...s, isPlaying: true }));
    }
  }

  const playPlaylist = useCallback((playlist: Playlist, trackIndex = 0) => {
    if (playlist.tracks.length === 0) return;
    if (stateRef.current.currentPlaylist?.id === playlist.id) return;
    const { order, pos } = buildPlayOrder(playlist.tracks.length, playlist.playMode ?? stateRef.current.playMode, trackIndex);
    playOrderRef.current = order;
    playPosRef.current = pos;
    playTrackInner(playlist, order[pos]);
  }, []);

  function currentTrackType() {
    const { currentPlaylist, currentTrackIndex } = stateRef.current;
    return currentPlaylist?.tracks[currentTrackIndex]?.type ?? null;
  }

  const pause = useCallback(() => {
    const type = currentTrackType();
    if (type === 'file' && audioRef.current) audioRef.current.pause();
    if (type === 'youtube' && ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.pauseVideo(); } catch {} }
    if (type === 'spotify' && spotifyControllerRef.current) { try { spotifyControllerRef.current.pause(); } catch {} }
    stopPoll();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    const type = currentTrackType();
    if (type === 'file' && audioRef.current) { audioRef.current.play().catch(() => {}); startPoll(); }
    if (type === 'youtube' && ytPlayerRef.current && ytReadyRef.current) { try { ytPlayerRef.current.playVideo(); } catch {} startPoll(); }
    if (type === 'spotify' && spotifyControllerRef.current) { try { spotifyControllerRef.current.resume(); } catch {} }
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  const stop = useCallback(() => {
    stopAudio();
    pendingVideoRef.current = null;
    if (ytContainerRef.current) ytContainerRef.current.style.display = 'none';
    if (spotifyContainerRef.current) spotifyContainerRef.current.style.display = 'none';
    setState((s) => ({ ...s, isPlaying: false, currentPlaylist: null, currentTime: 0, duration: 0, ytVisible: false, spotifyVisible: false }));
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
    if (spotifyControllerRef.current) { try { spotifyControllerRef.current.seek(t * 1000); } catch {} }
    setState((s) => ({ ...s, currentTime: t }));
  }, []);

  const setYtVisible = useCallback((v: boolean) => {
    if (ytContainerRef.current) {
      ytContainerRef.current.style.display = v ? 'block' : 'none';
    }
    setState((s) => ({ ...s, ytVisible: v }));
  }, []);

  const setSpotifyVisible = useCallback((v: boolean) => {
    if (spotifyContainerRef.current) {
      spotifyContainerRef.current.style.display = v ? 'block' : 'none';
    }
    setState((s) => ({ ...s, spotifyVisible: v }));
  }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    localStorage.setItem('gma:audio:playMode', mode);
    const { currentPlaylist, currentTrackIndex } = stateRef.current;
    if (currentPlaylist) {
      const { order, pos } = buildPlayOrder(currentPlaylist.tracks.length, mode, currentTrackIndex);
      playOrderRef.current = order;
      playPosRef.current = pos;
    }
    setState((s) => ({ ...s, playMode: mode }));
  }, []);

  return (
    <AudioCtx.Provider value={{ ...state, playPlaylist, pause, resume, stop, nextTrack, prevTrack, setVolume, setPlayMode, setYtVisible, setSpotifyVisible, seekTo }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
