// Имя кэша, чтобы различать версии
const CACHE_NAME = 'money2-cache-v11';

// Файлы, которые будут кэшироваться
const CACHE_ASSETS = [
    '/money2/',
    '/money2/index.html',
    '/money2/style.css',
    '/money2/app.js',
    '/money2/favicon.ico',
    '/money2/icon-192x192.png',
    '/money2/icon-512x512.png',
    '/money2/apple-touch-icon.png',
    '/money2/favicon-16x16.png',
    '/money2/favicon-32x32.png',
    'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
    'https://cdn.jsdelivr.net/npm/toastify-js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/hammerjs',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom'
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
