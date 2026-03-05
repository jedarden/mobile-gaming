// Mobile Gaming Service Worker
// Version: v1

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/shared/storage.js',
  '/shared/meta.js',
  '/shared/achievements.js',
  '/shared/daily.js',
  '/main.js',
  '/style.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Game assets (cache on first access)
const GAME_PATHS = [
  '/games/water-sort/',
  '/games/parking-escape/',
  '/games/bus-jam/',
  '/games/pull-pin/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old versions of our caches
              return name.startsWith('static-') && name !== STATIC_CACHE ||
                     name.startsWith('dynamic-') && name !== DYNAMIC_CACHE ||
                     name.startsWith('api-') && name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except CDN resources)
  if (url.origin !== location.origin) {
    return;
  }

  // Determine caching strategy based on resource type
  if (isStaticAsset(url.pathname)) {
    // Cache-first for static assets
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isGameData(url.pathname)) {
    // Network-first for game data (allows level updates)
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  } else if (isAPIRequest(url.pathname)) {
    // Stale-while-revalidate for API
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
  } else {
    // Network-first with cache fallback for everything else
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Caching strategies
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network fetch failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(cacheName);
        cache.then(c => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Helper functions
function isStaticAsset(pathname) {
  return pathname.match(/\.(js|css|png|jpg|svg|woff2?|ttf|eot)$/i) ||
         pathname === '/' ||
         pathname === '/index.html' ||
         pathname === '/manifest.json';
}

function isGameData(pathname) {
  return pathname.includes('/levels/') ||
         pathname.includes('/data/');
}

function isAPIRequest(pathname) {
  return pathname.startsWith('/api/');
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_GAME') {
    const gamePath = event.data.path;
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.add(gamePath);
    });
  }
});

// Background sync for offline progress
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncProgress());
  }
});

async function syncProgress() {
  // Future: Sync offline progress to server
  console.log('[SW] Syncing offline progress...');
}

console.log('[SW] Service worker loaded');
