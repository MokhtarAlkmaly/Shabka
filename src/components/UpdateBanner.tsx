import { useCallback, useEffect, useRef, useState } from "react";
import { applyUpdate, checkForUpdate, type UpdateInfo } from "../lib/updates";

const CHECK_EVERY_MS = 30 * 60 * 1000; // كل 30 دقيقة أثناء فتح التطبيق
const MIN_GAP_MS = 5 * 60 * 1000; // لا نفحص أكثر من مرة كل 5 دقائق عند الرجوع للتطبيق
const DISMISS_KEY = "shabka_update_dismissed";

const keyOf = (u: UpdateInfo) => (u.kind === "apk" ? u.version : u.build);

/** إشعار «يوجد تحديث جديد» أعلى التطبيق */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < MIN_GAP_MS) return;
    lastCheck.current = Date.now();
    const u = await checkForUpdate();
    if (u && sessionStorage.getItem(DISMISS_KEY) !== keyOf(u)) setUpdate(u);
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 3000);
    const timer = setInterval(() => {
      lastCheck.current = 0;
      check();
    }, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, [check]);

  if (!update) return null;

  const title =
    update.kind === "apk" ? "📲 نسخة جديدة من التطبيق متاحة" : "🔄 يوجد تحديث جديد للتطبيق";
  const desc =
    update.kind === "apk"
      ? `الإصدار ${update.version} يحتاج تنزيل ملف APK جديد وتثبيته.`
      : update.kind === "live"
        ? "سيتم تنزيل التحديث (أقل من 1 ميغابايت تقريباً) وإعادة تشغيل التطبيق، ويبقى يعمل بدون إنترنت."
        : "اضغط «تحديث الآن» لتحميل آخر نسخة.";
  const action = update.kind === "apk" ? "تنزيل" : "تحديث الآن";

  return (
    <div className="z-[1002] bg-gradient-to-l from-emerald-600 to-teal-600 px-3 py-2 text-white shadow-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold">{title}</div>
          <div className="text-[11px] text-emerald-50">{error ?? desc}</div>
          {"notes" in update && update.notes && !error && (
            <div className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11px] text-emerald-100/90">{update.notes}</div>
          )}
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await applyUpdate(update);
              if (update.kind === "apk") setBusy(false);
            } catch (e) {
              setBusy(false);
              setError(`تعذر التحديث: ${(e as Error).message || "تحقق من الاتصال"}`);
            }
          }}
          className="rounded-xl bg-white px-4 py-1.5 text-sm font-bold text-emerald-700 shadow hover:bg-emerald-50 disabled:opacity-70"
        >
          {busy ? "جارٍ التنزيل..." : action}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, keyOf(update));
            setUpdate(null);
          }}
          className="rounded-xl px-2 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-white/10"
        >
          لاحقاً
        </button>
      </div>
    </div>
  );
}
