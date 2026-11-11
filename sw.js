// sw.js — the service worker. It saves a copy of the app's files so the app
// opens offline. It is network-first: when you're online it always fetches the
// newest files (so each merged change shows up) and refreshes the saved copy;
// when you're offline it falls back to the saved copy.

const CACHE = 'electromart-ccc-v1';

// Relative paths, because the site lives at https://<username>.github.io/<repository>/
const FILES = [
  './',
  'index.html',
  'styles.css',
  'ccc.js',
  'app.js',
  'manifest.webmanifest',
  'data/electromart.csv',
  'data/assumptions.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  // Only handle this site's own GET requests.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./');
          return Response.error();
        });
      })
  );
});
