// Asks the service worker (see public/sw.js) to warm its cache for the given
// uploaded-asset URLs so scene/track switches during a session don't stall on
// the network. Fire-and-forget: the SW's cache-first fetch handling is what
// actually removes the delay, so callers don't need to await this.
export async function preloadAssets(urls: string[]): Promise<void> {
  if (!('serviceWorker' in navigator) || urls.length === 0) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'PRELOAD', urls });
}
