const CACHE_NAME = "krishi-brahmastra-v2";
const PRECACHE = ["/index.html"];

// Install: pre-cache app shell (fetch each individually so one failure doesn't kill the whole install)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Failed to precache:", url, err);
          })
        )
      ).then(() => self.skipWaiting())
    )
  );
});

// Activate: clean old caches + notify clients of update
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== CACHE_NAME)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Notify all open tabs that a new version is ready
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED" });
          });
        });
      })
  );
});

// Fetch strategies
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. API requests: pass through to browser (never intercept, never cache)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 2. Navigation: network-first, fallback to cached shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache the latest index.html for offline SPA navigation
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/index.html", clone));
          return res;
        })
        .catch(() => caches.match("/index.html") || caches.match("/"))
    );
    return;
  }

  // 3. Same-origin static assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((networkRes) => {
              // Only cache successful same-origin responses
              if (networkRes && networkRes.status === 200) {
                cache.put(event.request, networkRes.clone());
              }
              return networkRes;
            })
            .catch(() => cached); // Offline + not cached: fail gracefully

          // Return cached version immediately if available, otherwise wait for network
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // 4. Cross-origin (fonts, tiles): cache-first
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
    )
  );
});
