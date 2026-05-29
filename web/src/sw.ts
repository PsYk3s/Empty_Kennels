/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Handle skip waiting message for instant updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Precache static assets
const manifestEntries = self.__WB_MANIFEST || [];
precacheAndRoute(manifestEntries);
cleanupOutdatedCaches();

// Network-first strategy for API calls
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/') ||
    url.hostname !== self.location.hostname,
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 3600, // 1 hour
        maxEntries: 50,
      }),
    ],
  })
);

// Cache-first for static assets
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 2592000, // 30 days
        maxEntries: 100,
      }),
    ],
  })
);

// Navigation requests should prefer the network so reloads stay consistent.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'html-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 3600,
        maxEntries: 10,
      }),
    ],
  })
);
