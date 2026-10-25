import { Capacitor } from "@capacitor/core";

/**
 * فحص التحديثات وإظهار إشعار داخل التطبيق.
 *
 * - في المتصفح (Vercel): نقارن معرّف النسخة الحالية بملف /version.json المنشور → إعادة تحميل الصفحة.
 * - في تطبيق أندرويد: نقرأ آخر إصدار (Release) من GitHub:
 *     • إذا لم يتغير الجزء الأصلي (nativeHash) → تحديث الواجهة مباشرة داخل التطبيق (bundle.zip)
 *       ويبقى محفوظاً للعمل بدون إنترنت.
 *     • إذا تغيّر → إشعار بتنزيل ملف APK الجديد.
 */

export const APP_BUILD = __APP_BUILD__;
export const NATIVE_HASH = __NATIVE_HASH__;
export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || "MokhtarAlkmaly/Shabka";

export const isNative = Capacitor.isNativePlatform();

export type UpdateInfo =
  | { kind: "web"; build: string }
  | { kind: "live"; build: string; version: string; url: string; notes?: string }
  | { kind: "apk"; version: string; url: string; notes?: string };

interface ReleaseMeta {
  build: string;
  nativeHash: string;
}

interface GithubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: { name: string; browser_download_url: string }[];
}

export const shortBuild = (b: string) => (b.startsWith("local-") ? "محلية" : b.slice(0, 7));

/** رقم البناء من وسم الإصدار v1.0.N */
function releaseNumber(tag: string): number {
  const m = /(\d+)$/.exec(tag);
  return m ? Number(m[1]) : 0;
}

function parseMeta(body = ""): ReleaseMeta | null {
  const m = /<!--\s*shabka-meta\s+(\{.*?\})\s*-->/s.exec(body);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as ReleaseMeta;
  } catch {
    return null;
  }
}

function releaseNotes(body = ""): string | undefined {
  const txt = body.replace(/<!--[\s\S]*?-->/g, "").trim();
  return txt ? txt.slice(0, 400) : undefined;
}

async function checkWeb(): Promise<UpdateInfo | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const v = (await res.json()) as { build?: string };
  if (v.build && v.build !== APP_BUILD) return { kind: "web", build: v.build };
  return null;
}

async function checkNative(): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rel = (await res.json()) as GithubRelease;
  const meta = parseMeta(rel.body);
  if (!meta || meta.build === APP_BUILD) return null;

  // لا نعرض «تحديثاً» أقدم من النسخة المثبتة
  const { App } = await import("@capacitor/app");
  const info = await App.getInfo();
  const installed = Number(info.build) || 0;
  const latest = releaseNumber(rel.tag_name);
  if (latest && installed && latest < installed) return null;

  const notes = releaseNotes(rel.body);
  const version = rel.tag_name;
  const apk = rel.assets.find((a) => a.name === "shabka.apk");
  const bundle = rel.assets.find((a) => a.name === "bundle.zip");

  if (meta.nativeHash !== NATIVE_HASH) {
    if (!apk || latest <= installed) return null;
    return { kind: "apk", version, url: apk.browser_download_url, notes };
  }
  if (bundle) return { kind: "live", build: meta.build, version, url: bundle.browser_download_url, notes };
  if (apk && latest > installed) return { kind: "apk", version, url: apk.browser_download_url, notes };
  return null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!navigator.onLine) return null;
  try {
    return isNative ? await checkNative() : await checkWeb();
  } catch {
    return null;
  }
}

/** تطبيق التحديث. في حالة live يتم تنزيل الواجهة ثم إعادة تشغيلها تلقائياً. */
export async function applyUpdate(u: UpdateInfo): Promise<void> {
  if (u.kind === "web") {
    window.location.reload();
    return;
  }
  if (u.kind === "apk") {
    // Capacitor يفتح الروابط الخارجية في متصفح الجوال لتنزيل الملف
    window.location.href = u.url;
    return;
  }
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  const bundle = await CapacitorUpdater.download({ url: u.url, version: `${u.version}-${shortBuild(u.build)}` });
  await CapacitorUpdater.set({ id: bundle.id });
}

/** يجب استدعاؤها عند بدء التطبيق، وإلا يرجع تلقائياً للنسخة السابقة (حماية من التحديثات المعطوبة) */
export async function markAppReady(): Promise<void> {
  if (!isNative) return;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch {
    /* ignore */
  }
}
