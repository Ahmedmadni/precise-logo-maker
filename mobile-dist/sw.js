/**
 * Logo Grid Studio service worker.
 *
 * Hand-written on purpose: the project has no build-time PWA plugin, so the
 * hashed asset names are unknown here. Instead of a precache manifest it caches
 * what the app actually requests, which is enough to open and keep working
 * offline after the first visit. Documents autosave to local storage, so an
 * offline launch still restores the drawing in progress.
 */

const VERSION = "v1";
const SHELL_CACHE = `logo-grid-shell-${VERSION}`;
const ASSET_CACHE = `logo-grid-assets-${VERSION}`;

/** Always available offline: the app shell entry and its static extras. */
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One bad URL must not fail the whole install.
      await Promise.allSettled(
        SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** Lets a freshly installed worker take over as soon as the page asks it to. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") void self.skipWaiting();
});

const isStaticAsset = (request) =>
  ["script", "style", "font", "image", "manifest"].includes(request.destination);

/** Network first, falling back to the cached shell so the app opens offline. */
const handleNavigation = async (request) => {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put("/", response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match("/")) ?? Response.error();
  }
};

/** Serve from cache immediately, refresh in the background. */
const handleAsset = async (request) => {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const response = await network;
  return response ?? Response.error();
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Server functions and API traffic must always hit the network.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (isStaticAsset(request)) event.respondWith(handleAsset(request));
});
