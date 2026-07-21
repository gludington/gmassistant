// Caches uploaded assets (images, audio files) so scene/track switches during
// a live session never wait on the network. Never touches /api or YouTube —
// those keep working exactly as before.
const CACHE_NAME = 'gma-assets-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/uploads/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PRELOAD') return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        urls.map(async (url) => {
          try {
            const existing = await cache.match(url);
            if (existing) return;
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          } catch {
            // Best-effort — a failed prefetch just falls back to a normal
            // network request when the asset is actually used.
          }
        })
      );
      const client = event.source;
      if (client) client.postMessage({ type: 'PRELOAD_DONE' });
    })()
  );
});
