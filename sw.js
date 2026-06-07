// Species Identifier — service worker
// Caches the app shell so it installs to the home screen and opens offline.
// Network requests to the Gemini API and map tiles always go to the network.

const CACHE = 'species-id-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache the Gemini API — always hit the network.
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  // Map tiles: network-first, fall back to cache if offline.
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // App shell & everything else: cache-first, fall back to network.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      // Cache same-origin and known CDN responses opportunistically.
      if (res.ok && (url.origin === location.origin || url.hostname.includes('unpkg.com'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
