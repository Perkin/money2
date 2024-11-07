// Имя кэша, чтобы различать версии
const CACHE_NAME = 'money2-cache-v1';

// Файлы, которые будут кэшироваться
const CACHE_ASSETS = [
    '/money2/',
    '/money2/index.html',
    '/money2/styles.css',
    '/money2/app.js',
    '/money2/favicon.ico',
    '/money2/icon-192x192.png',
    '/money2/icon-512x512.png',
    '/money2/apple-touch-icon.png',
    '/money2/favicon-16x16.png',
    '/money2/favicon-32x32.png',
    '/money2/screenshot-mobile.png',
    '/money2/screenshot-wide.png'
];

// Устанавливаем кэш
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэшируем файлы...');
                return cache.addAll(CACHE_ASSETS);
            })
    );
});

// Активируем воркер и удаляем старые кэши
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Удаляем старый кэш:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Интерсептируем запросы и обслуживаем из кэша
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});
