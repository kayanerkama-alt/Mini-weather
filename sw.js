// Service Worker - Offline support & caching
const CACHE_NAME = 'mini-weather-v5';
const BASE_URL = self.location.origin;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache essential files
            return Promise.all([
                cache.add(`${BASE_URL}/`),
                cache.add(`${BASE_URL}/index.html`).catch(() => {})
            ]).catch(() => {});
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('mini-weather')) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Chrome extensions and other non-http(s) requests
    if (!url.startsWith('http')) return;

    // API requests - network first with fallback
    if (url.includes('open-meteo.com') ||
        url.includes('weatherapi.com') ||
        url.includes('weather.gov') ||
        url.includes('wttr.in') ||
        url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => new Response(JSON.stringify({error: 'Offline'}), {
                    status: 503,
                    headers: {'Content-Type': 'application/json'}
                }))
        );
        return;
    }

    // Static assets - stale while revalidate
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(response => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                    }
                    return response;
                }).catch(() => null);
                
                return cachedResponse || fetchPromise;
            })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, event.data.options || {});
    }
});

