const CACHE_NAME = "trickee-shell-v4";
const SHELL_ASSETS = ["/login", "/icon.png", "/trickee.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("trickee-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .catch(() => undefined)
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never cache partial video responses, external services, or Next.js RSC data.
  if (url.origin !== self.location.origin || request.headers.has("range")) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/api/v1/")) return;
  if (request.mode !== "navigate" && !["script", "style", "image", "font"].includes(request.destination)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200 && request.destination !== "document") {
          const clone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return (await caches.match("/login")) || Response.error();
        return Response.error();
      })
  );
});
