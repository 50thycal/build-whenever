// Simple app-shell cache for Meditate-001
const CACHE = 'meditate-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  // icons are optional; add if present:
  './public/icon-192.png',
  './public/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.filter(Boolean));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});
