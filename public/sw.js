// Mobile Gaming Service Worker
// Version: v2 - Enhanced caching and performance

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Cache durations (in seconds)
const CACHE_DURATIONS = {
  static: 30 * 24 * 60 * 60,    // 30 days
  dynamic: 24 * 60 * 60,         // 1 day
  images: 7 * 24 * 60 * 60,      // 7 days
};

// Static assets to cache immediately (Vite handles the actual file paths)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Game paths for preloading
const GAME_PATHS = [
  '/games/water-sort/',
  '/games/parking-escape/',
  '/games/bus-jam/',
  '/games/pull-the-pin/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache what we can, don't fail if some assets don't exist yet
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.log(`[SW] Could not cache ${url}:`, err.message);
            })
          )
        );
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

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old versions of our caches
              return name.startsWith('static-') && name !== STATIC_CACHE ||
                     name.startsWith('dynamic-') && name !== DYNAMIC_CACHE ||
                     name.startsWith('images-') && name !== IMAGE_CACHE ||
                     name.startsWith('api-'); // Remove old API cache
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

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip browser extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Determine caching strategy based on resource type
  const strategy = getStrategy(url.pathname);

  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      break;
    case 'network-first':
      event.respondWith(networkFirst(request, DYNAMIC_CACHE));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
      break;
    default:
      event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

/**
 * Determine caching strategy for a given path
 */
function getStrategy(pathname) {
  // Static assets - cache first
  if (pathname.match(/\.(js|css|woff2?|ttf)$/i)) {
    return 'cache-first';
  }

  // Images - stale while revalidate
  if (pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/i)) {
    return 'stale-while-revalidate';
  }

  // Game pages and levels - network first (for updates)
  if (pathname.includes('/games/') || pathname.includes('/levels/')) {
    return 'network-first';
  }

  // HTML pages - network first
  if (pathname.endsWith('.html') || pathname.endsWith('/')) {
    return 'network-first';
  }

  // Default - network first
  return 'network-first';
}

/**
 * Cache-first strategy
 * Best for static assets that rarely change
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Return cached version, update cache in background
    updateCache(request, cacheName);
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
    console.log('[SW] Cache-first fetch failed:', request.url);
    return offlineResponse(request);
  }
}

/**
 * Network-first strategy
 * Best for content that should be fresh
 */
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
    return offlineResponse(request);
  }
}

/**
 * Stale-while-revalidate strategy
 * Best for images and fonts - fast response with background update
 */
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

  // Return cached version immediately, or wait for network
  return cached || fetchPromise;
}

/**
 * Update cache in background
 */
async function updateCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
  } catch {
    // Silently fail background updates
  }
}

/**
 * Generate offline response
 */
function offlineResponse(request) {
  const url = new URL(request.url);

  // For HTML pages, return the cached index
  if (request.headers.get('Accept')?.includes('text/html')) {
    return caches.match('/').then(cached => {
      if (cached) return cached;
      return new Response(
        '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
        {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    });
  }

  // For other requests, return 503
  return new Response('Offline', { status: 503 });
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_GAME') {
    const gamePath = event.data.path;
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.add(gamePath).then(() => {
        console.log('[SW] Cached game:', gamePath);
      });
    });
  }

  if (event.data && event.data.type === 'PREFETCH') {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then((cache) => {
      urls.forEach(url => {
        cache.add(url).catch(() => {});
      });
    });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      })
    );
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

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-games') {
    event.waitUntil(updateGameCache());
  }
});

async function updateGameCache() {
  // Preload game assets in background
  const cache = await caches.open(DYNAMIC_CACHE);
  for (const gamePath of GAME_PATHS) {
    try {
      await cache.add(gamePath);
    } catch {
      // Ignore errors
    }
  }
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Mobile Gaming', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('[SW] Service worker v2 loaded');
