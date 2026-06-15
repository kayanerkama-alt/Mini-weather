// Service Worker - Offline support & caching
const CACHE_NAME = 'mini-weather-v3';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(URLS_TO_CACHE).catch(() => {});
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // API requests - network first
    if (event.request.url.includes('api.weatherapi.com') ||
        event.request.url.includes('api.open-meteo.com') ||
        event.request.url.includes('api.weather.gov') ||
        event.request.url.includes('wttr.in') ||
        event.request.url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const cache = caches.open(CACHE_NAME);
                        cache.then(c => c.put(event.request, response.clone()));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Static assets - cache first
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(() => new Response('Offline'))
    );
});

self.addEventListener('message', event => {
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, event.data.options);
    }
});

