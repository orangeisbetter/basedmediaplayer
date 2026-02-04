const CACHE_NAME = "v1";

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll([
                // "/",
                // "/manifest.json",
                // "/style.css",
                // "/dist/main.js",
                // "/caret.svg",
                // "/missing.png",
            ])
        )
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k != CACHE_NAME)
                    .map(k => caches.delete(k))
            )
        )
    )
})

// self.addEventListener("fetch", event =>
//     event.respondWith(
//         caches.match(event.request).then(res => res || fetch(event.request))
//     )
// );