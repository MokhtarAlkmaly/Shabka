import L from "leaflet";

/**
 * تخزين بلاطات الخريطة (Tiles) محلياً باستخدام Cache Storage
 * حتى تظهر المناطق التي تصفحتها سابقاً عند انقطاع الإنترنت.
 */

const CACHE_NAME = "shabka-tiles-v1";
/** بعد هذه المدة نحاول تحديث البلاطة من الشبكة (إن وُجد اتصال) */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** الحد الأقصى لعدد البلاطات المخزنة (~150-250 ميغابايت) */
const MAX_TILES = 8000;
const CACHED_AT = "x-cached-at";

const supported = typeof window !== "undefined" && "caches" in window;

let cachePromise: Promise<Cache> | null = null;
function openCache(): Promise<Cache> {
  if (!cachePromise) cachePromise = caches.open(CACHE_NAME);
  return cachePromise;
}

async function fetchAndStore(cache: Cache, url: string, key: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const headers = new Headers({
    "content-type": res.headers.get("content-type") || "image/png",
    [CACHED_AT]: String(Date.now()),
  });
  cache.put(key, new Response(blob, { headers })).catch(() => {});
  return blob;
}

/** يعيد رابط blob للبلاطة من الذاكرة المحلية أو من الشبكة */
async function loadTile(url: string, key: string): Promise<string> {
  if (!supported) return url;
  const cache = await openCache();
  const hit = await cache.match(key);
  if (hit) {
    const age = Date.now() - Number(hit.headers.get(CACHED_AT) || 0);
    if (age < MAX_AGE_MS || !navigator.onLine) {
      return URL.createObjectURL(await hit.blob());
    }
    try {
      return URL.createObjectURL(await fetchAndStore(cache, url, key));
    } catch {
      return URL.createObjectURL(await hit.blob());
    }
  }
  return URL.createObjectURL(await fetchAndStore(cache, url, key));
}

type TileCb = (err: Error | null, tile: HTMLElement) => void;
interface TileLayerInternals {
  _tileOnLoad: (done: TileCb, tile: HTMLElement) => void;
  _tileOnError: (done: TileCb, tile: HTMLElement, e: Error) => void;
}

export interface CachedTileLayerOptions extends L.TileLayerOptions {
  /** معرّف ثابت للطبقة يُستخدم في مفتاح التخزين (بدل النطاق الفرعي a/b/c) */
  cacheId: string;
}

export class CachedTileLayer extends L.TileLayer {
  declare options: CachedTileLayerOptions;

  constructor(url: string, options: CachedTileLayerOptions) {
    super(url, options);
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement("img");
    img.alt = "";
    img.setAttribute("role", "presentation");
    const self = this as unknown as TileLayerInternals;
    img.addEventListener("load", () => {
      self._tileOnLoad(done as TileCb, img);
      if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    });
    img.addEventListener("error", (e) => self._tileOnError(done as TileCb, img, e as unknown as Error));

    const url = this.getTileUrl(coords);
    const z = (this as unknown as { _getZoomForUrl: () => number })._getZoomForUrl();
    const key = `https://tiles.shabka.local/${this.options.cacheId}/${z}/${coords.x}/${coords.y}`;
    loadTile(url, key)
      .then((src) => {
        img.src = src;
      })
      .catch(() => {
        // فشل fetch (انقطاع أو CORS) — نجرب التحميل العادي للصورة
        img.src = url;
      });
    return img;
  }
}

/** عدد البلاطات المحفوظة */
export async function getTileCacheCount(): Promise<number> {
  if (!supported) return 0;
  const cache = await openCache();
  return (await cache.keys()).length;
}

/** حذف كل البلاطات المحفوظة */
export async function clearTileCache(): Promise<void> {
  if (!supported) return;
  cachePromise = null;
  await caches.delete(CACHE_NAME);
}

/** حذف أقدم البلاطات إذا تجاوز العدد الحد الأقصى */
export async function trimTileCache(): Promise<void> {
  if (!supported) return;
  const cache = await openCache();
  const keys = await cache.keys();
  if (keys.length <= MAX_TILES) return;
  const excess = keys.slice(0, keys.length - Math.floor(MAX_TILES * 0.9));
  for (const k of excess) await cache.delete(k);
}

export const tileCacheSupported = supported;
