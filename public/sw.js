/**
 * Service Worker for Mobile Gaming PWA
 *
 * Provides offline-first caching strategy:
 * - Static assets (JS, CSS): cache-first, long TTL
 * - HTML pages: network-first with cache fallback
 * - Game levels (JSON): stale-while-revalidate
 *
 * Games are playable offline after first load.
 */

const CACHE_NAME = 'mobile-gaming-v1';
const STATIC_CACHE = 'mobile-gaming-static-v1';
const DYNAMIC_CACHE = 'mobile-gaming-dynamic-v1';

// Static assets to precache (will be extended during install)
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json'
];

// Patterns for different caching strategies
const STATIC_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\/icons\//,
  /\.woff2?$/
];

const LEVELS_PATTERN = /\/levels\.json$/;

/**
 * Check if URL matches any pattern
 */
function matchesPattern(url, patterns) {
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Install event - precache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);

      // Precache static assets
      await staticCache.addAll(PRECACHE_ASSETS);

      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => caches.delete(name))
      );

      // Take control of all pages immediately
      await self.clients.claim();
    })()
  );
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Determine caching strategy
  if (matchesPattern(url.pathname, STATIC_PATTERNS)) {
    // Cache-first for static assets
    event.respondWith(cacheFirst(request));
  } else if (LEVELS_PATTERN.test(url.pathname)) {
    // Stale-while-revalidate for game levels
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    // Network-first for HTML pages
    event.respondWith(networkFirst(request));
  } else {
    // Network-first with cache fallback for everything else
    event.respondWith(networkFirst(request));
  }
});

/**
 * Cache-first strategy
 * Good for static assets that don't change often
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return offline fallback if available
    return caches.match(request) || new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy
 * Good for HTML pages where fresh content matters
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses for offline use
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page or error
    return new Response('Offline - Please connect to the internet', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Stale-while-revalidate strategy
 * Good for game levels - return cached immediately, update in background
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);

  // Start network fetch regardless of cache status
  const networkFetch = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  // Return cached version if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Otherwise wait for network
  const networkResponse = await networkFetch;

  if (networkResponse) {
    return networkResponse;
  }

  // No cache and no network
  return new Response('{"error": "Offline"}', {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Message event - handle cache management requests
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names =>
        Promise.all(names.map(name => caches.delete(name)))
      )
    );
  }

  if (event.data && event.data.type === 'CACHE_GAME') {
    // Cache all assets for a specific game
    const gameId = event.data.gameId;
    event.waitUntil(cacheGameAssets(gameId));
  }
});

/**
 * Cache all assets for a specific game
 */
async function cacheGameAssets(gameId) {
  const cache = await caches.open(DYNAMIC_CACHE);

  // Game-specific assets to cache
  const gameAssets = [
    `/${gameId}/`,
    `/${gameId}/game.js`,
    `/${gameId}/styles.css`,
    `/${gameId}/levels.json`
  ];

  // Try to cache each asset
  await Promise.all(
    gameAssets.map(async (asset) => {
      try {
        const response = await fetch(asset);
        if (response.ok) {
          await cache.put(asset, response);
        }
      } catch {
        // Ignore fetch errors
      }
    })
  );
}
