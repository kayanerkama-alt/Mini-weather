// Service Worker - Offline support, caching, and notifications
const CACHE_NAME = 'mini-weather-v2';
const CACHE_ASSETS = 'mini-weather-assets-v2';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/sw.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => {
                return cache.addAll(URLS_TO_CACHE).catch(() => {});
            }),
            caches.open(CACHE_ASSETS)
        ])
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== CACHE_ASSETS) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // API requests - network first with fallback
    if (url.hostname.includes('api.open-meteo.com') ||
        url.hostname.includes('api.weather.gov') ||
        url.hostname.includes('wttr.in') ||
        url.hostname.includes('nominatim.openstreetmap.org') ||
        url.hostname.includes('weather.gov')) {
        event.respondWith(
            fetch(event.request, { timeout: 8000 })
                .then(response => {
                    if (response && response.ok) {
                        const cache = caches.open(CACHE_ASSETS);
                        cache.then(c => c.put(event.request, response.clone()));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request) || 
                        new Response(JSON.stringify({ error: 'Offline' }), {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({ 'Content-Type': 'application/json' })
                        });
                })
        );
        return;
    }

    // Static assets - cache first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const cache = caches.open(CACHE_ASSETS);
                            cache.then(c => c.put(event.request, response.clone()));
                        }
                        return response;
                    })
                    .catch(() => new Response('Offline', { status: 503 }));
            })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        self.registration.showNotification(title, {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            ...options
        }).catch(err => console.log('Notification failed:', err));
    }
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-weather') {
        event.waitUntil(
            fetch('/api/weather').catch(() => Promise.resolve())
        );
    }
});
