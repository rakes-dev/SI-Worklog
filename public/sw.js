const CACHE_NAME = 'si-worklog-v3';
const APP_SHELL_CACHE = 'si-worklog-shell-v3';
const DYNAMIC_CACHE = 'si-worklog-dynamic-v3';

// Assets to pre-cache on install
const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first with cache fallback (never fake 408s, never stale app code)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs. API routes, Firebase (Firestore/Auth) and all
  // other cross-origin traffic use their own connections and must NOT be touched.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests (HTML pages), use network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Everything else: NETWORK-FIRST with cache fallback. (The previous
  // cache-first strategy served stale Next.js chunks/RSC payloads after
  // deploys, and the old offline fallback returned a fake 408 that surfaced as
  // console errors.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful basic responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline fallback: placeholder for images, honest 503 otherwise.
          if (request.destination === 'image') {
            return caches.match('/icons/icon-192.png');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        })
      )
  );
});