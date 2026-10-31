/* شبكة — Service Worker
 * الهدف: السماح بتثبيت التطبيق على الجوال (PWA) وفتحه وبدون إنترنت.
 *
 * الاستراتيجية:
 *  - التنقل (index.html): الشبكة أولاً ثم النسخة المحفوظة — حتى تصل التحديثات دائماً، ويعمل بدون إنترنت.
 *  - version.json: الشبكة فقط (لا يُحفظ) لأن التطبيق يقارن به النسخة الحالية.
 *  - الأصول الثابتة (أيقونات/خطوط/بلاطات الخرائط): من الذاكرة أولاً مع تحديث في الخلفية.
 *  - بلاطات الخرائط: تُحفظ بسقف حجم، والتطبيق نفسه يدير ذاكرة أوسع في IndexedDB.
 */

const VERSION = "shabka-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const TILE_CACHE = `${VERSION}-tiles`;

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "basemaps.cartocdn.com",
  "server.arcgisonline.com",
];

const TILE_CACHE_LIMIT = 600;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // فشل عنصر واحد لا يجب أن يُفشل التثبيت بأكمله
      await Promise.all(
        SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {}))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }
      await self.clients.claim();
    })()
  );
});

/** تقييد حجم ذاكرة البلاطات */
async function trimTiles() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_CACHE_LIMIT) return;
  const extra = keys.length - TILE_CACHE_LIMIT;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

function isTile(url) {
  return TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

/** الشبكة أولاً ثم الذاكرة — مع تحديث النسخة المحفوظة */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && (fresh.ok || fresh.type === "opaque")) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error("offline");
  }
}

/** الذاكرة أولاً مع تحديث خلفي */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((res) => res && res.ok && cache.put(request, res.clone()))
      .catch(() => {});
    return cached;
  }
  const fresh = await fetch(request);
  if (fresh && (fresh.ok || fresh.type === "opaque")) {
    cache.put(request, fresh.clone()).catch(() => {});
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // لا نتدخّل في طلبات تحديث النسخة أو GitHub API أو أي طلب غير http(s)
  if (!url.protocol.startsWith("http")) return;
  if (url.pathname.endsWith("/version.json")) return;
  if (url.hostname === "api.github.com" || url.hostname.endsWith("github.com")) return;

  // صفحات التطبيق
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request, SHELL_CACHE);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            new Response("التطبيق غير متاح بدون إنترنت بعد. افتحه مرة واحدة وأنت متصل.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // بلاطات الخرائط
  if (isTile(url)) {
    event.respondWith(
      (async () => {
        try {
          const res = await cacheFirst(request, TILE_CACHE);
          trimTiles();
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })()
    );
    return;
  }

  // أصول من نفس النطاق (أيقونات، خطوط، manifest)
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          return await cacheFirst(request, ASSET_CACHE);
        } catch {
          return new Response("", { status: 504 });
        }
      })()
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
