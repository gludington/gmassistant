import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { SceneFit } from '@gmassisstant/types';
import { useBroadcastSender } from './useBroadcast';

interface PlayerImage { filePath: string; fit: SceneFit }

interface PlayerScreenContextValue {
  playerImage: PlayerImage | null;
  showImage: (filePath: string, fit: SceneFit) => void;
  clearImage: () => void;
  updateFit: (filePath: string, fit: SceneFit) => void;
}

const PlayerScreenCtx = createContext<PlayerScreenContextValue | null>(null);

export function PlayerScreenProvider({ children }: { children: ReactNode }) {
  const [playerImage, setPlayerImage] = useState<PlayerImage | null>(null);
  const send = useBroadcastSender();

  const showImage = useCallback((filePath: string, fit: SceneFit) => {
    setPlayerImage({ filePath, fit });
    send({ type: 'SHOW_IMAGE', payload: { filePath, fit } });
    send({ type: 'TOGGLE_INITIATIVE', payload: { visible: false } });
    try {
      const raw = localStorage.getItem('gma:initiative');
      if (raw) localStorage.setItem('gma:initiative', JSON.stringify({ ...JSON.parse(raw), visible: false }));
    } catch {}
  }, [send]);

  const clearImage = useCallback(() => {
    setPlayerImage(null);
    send({ type: 'CLEAR_IMAGE' });
  }, [send]);

  // Update fit in context when the GM changes fit on a currently-showing image.
  const updateFit = useCallback((filePath: string, fit: SceneFit) => {
    setPlayerImage(prev => prev?.filePath === filePath ? { filePath, fit } : prev);
  }, []);

  return (
    <PlayerScreenCtx.Provider value={{ playerImage, showImage, clearImage, updateFit }}>
      {children}
    </PlayerScreenCtx.Provider>
  );
}

export function usePlayerScreen() {
  const ctx = useContext(PlayerScreenCtx);
  if (!ctx) throw new Error('usePlayerScreen must be used within PlayerScreenProvider');
  return ctx;
}
