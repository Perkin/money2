self.addEventListener('install', event => {
    event.waitUntil(
        caches.open('app-cache').then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',
                '/app.js',
                '/favicon.ico',
                '/icon-192x192.png',
                '/icon-512x512.png',
                '/apple-touch-icon.png',
                '/favicon-16x16.png',
                '/favicon-32x32.png'
            ]);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
