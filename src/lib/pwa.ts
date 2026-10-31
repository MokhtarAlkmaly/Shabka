import { Capacitor } from "@capacitor/core";

/**
 * دعم تثبيت التطبيق كـ PWA (إضافة إلى الشاشة الرئيسية).
 *
 * - أندرويد/كروم: يُلتقط حدث beforeinstallprompt لعرض زر تثبيت أصلي.
 * - آيفون (سفاري): لا يوجد حدث، فنعرض إرشادات «مشاركة ← إضافة إلى الشاشة الرئيسية».
 * - داخل تطبيق أندرويد (Capacitor): لا شيء (التطبيق مثبّت أصلاً).
 */

export type Platform = "android" | "ios" | "desktop" | "native";

export const isNativeApp = Capacitor.isNativePlatform();

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export function detectPlatform(): Platform {
  if (isNativeApp) return "native";
  const ua = navigator.userAgent;
  // آيباد الحديث يعرّف نفسه كسفاري على ماك
  const isIPad = /Macintosh/.test(ua) && "ontouchend" in document;
  if (/iPad|iPhone|iPod/.test(ua) || isIPad) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** هل التطبيق مفتوح كتطبيق مثبّت (لا داخل تبويب متصفح)؟ */
export function isStandalone(): boolean {
  if (isNativeApp) return true;
  const modes = ["standalone", "fullscreen", "minimal-ui"];
  if (modes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches)) return true;
  // سفاري على iOS
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
}

/** يجب استدعاؤها مرة واحدة عند إقلاع التطبيق (يعمل حتى قبل تحميل React) */
export function initPwa() {
  if (isNativeApp) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    localStorage.setItem("shabka_installed", "1");
    notify();
  });

  // تسجيل الـ Service Worker — شرط أساسي لظهور خيار التثبيت في كروم
  if ("serviceWorker" in navigator) {
    const register = () => {
      const base = import.meta.env.BASE_URL || "/";
      navigator.serviceWorker
        .register(`${base}sw.js`, { scope: base })
        .catch((err) => console.warn("[pwa] تعذّر تسجيل service worker:", err));
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}
