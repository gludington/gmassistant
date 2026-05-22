import { useEffect, useRef, useCallback } from 'react';
import type { BroadcastMessage } from '@gmassisstant/types';

const CHANNEL = 'gmassisstant';

export function useBroadcastSender() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL);
    return () => channelRef.current?.close();
  }, []);

  return useCallback((message: BroadcastMessage) => {
    channelRef.current?.postMessage(message);
  }, []);
}

export function useBroadcastReceiver(
  handler: (message: BroadcastMessage) => void,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      handlerRef.current(event.data);
    };
    return () => channel.close();
  }, []);
}
