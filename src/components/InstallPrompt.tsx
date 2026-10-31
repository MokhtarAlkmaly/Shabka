import { useCallback, useEffect, useState } from "react";
import {
  detectPlatform,
  getInstallPrompt,
  isStandalone,
  promptInstall,
  subscribeInstall,
  type Platform,
} from "../lib/pwa";

const APK_URL = "https://github.com/MokhtarAlkmaly/Shabka/releases/latest/download/shabka.apk";
const DISMISS_KEY = "shabka_install_dismissed";

/** زر/إشعار تثبيت التطبيق على الجوال (PWA) مع إرشادات لكل نظام */
export default function InstallPrompt() {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [canPrompt, setCanPrompt] = useState(() => !!getInstallPrompt());
  const [installed, setInstalled] = useState(() => isStandalone());
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState(false);
  const [busy, setBusy] = useState(false);

  // متابعة توفّر حدث التثبيت الأصلي (كروم/أندرويد)
  useEffect(() => {
    const update = () => {
      setCanPrompt(!!getInstallPrompt());
      setInstalled(isStandalone());
    };
    return subscribeInstall(update);
  }, []);

  // فتح نافذة الإرشادات من الشريط العلوي
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("shabka:open-install", onOpen);
    return () => window.removeEventListener("shabka:open-install", onOpen);
  }, []);

  // إشعار لطيف مرة واحدة بعد قليل من الاستخدام
  useEffect(() => {
    if (installed || platform === "native") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const t = setTimeout(() => setBanner(true), 9000);
    return () => clearTimeout(t);
  }, [installed, platform]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setBanner(false);
  }, []);

  const install = useCallback(async () => {
    setBusy(true);
    try {
      const res = await promptInstall();
      if (res === "accepted") {
        setInstalled(true);
        setBanner(false);
        setOpen(false);
      } else if (res === "unavailable") {
        setOpen(true); // لا يوجد حدث أصلي → نعرض الإرشادات
      }
    } finally {
      setBusy(false);
    }
  }, []);

  if (installed || platform === "native") return null;

  const steps: { icon: string; text: string }[] =
    platform === "ios"
      ? [
          { icon: "⬆️", text: "اضغط زر «مشاركة» في أسفل سفاري (المربع مع السهم الأعلى)." },
          { icon: "➕", text: "اختر «إضافة إلى الشاشة الرئيسية»." },
          { icon: "✅", text: "اضغط «إضافة» — ستظهر أيقونة شبكة مع بقية تطبيقاتك." },
        ]
      : platform === "android"
        ? canPrompt
          ? [{ icon: "📲", text: "اضغط الزر أدناه، ثم أكّد «تثبيت» في نافذة المتصفح." }]
          : [
              { icon: "⋮", text: "اضغط قائمة النقاط الثلاث أعلى متصفح كروم." },
              { icon: "📲", text: "اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»." },
              { icon: "✅", text: "أكّد التثبيت — سيُفتح التطبيق بملء الشاشة وبدون شريط العنوان." },
            ]
        : [
            { icon: "💻", text: "من شريط العنوان في المتصفح اضغط أيقونة التثبيت (شاشة صغيرة مع سهم)." },
            { icon: "✅", text: "أكّد «تثبيت» — سيُفتح التطبيق في نافذة مستقلة." },
          ];

  return (
    <>
      {/* إشعار سفلي */}
      {banner && !open && (
        <div className="fixed inset-x-2 bottom-2 z-[1005] mx-auto max-w-md rounded-2xl bg-slate-900/95 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-start gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl shadow" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold">ثبّت «شبكة» على جوالك</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                أيقونة على الشاشة الرئيسية + فتح أسرع وبدون شريط المتصفح، ويعمل بدون إنترنت للخرائط المحفوظة.
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={install}
                  disabled={busy}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-70"
                >
                  {busy ? "..." : canPrompt ? "تثبيت الآن" : "كيف أثبّت؟"}
                </button>
                <button
                  onClick={() => setOpen(true)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  إرشادات
                </button>
                <button
                  onClick={dismissBanner}
                  className="mr-auto rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  لاحقاً
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الإرشادات */}
      {open && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            dir="rtl"
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center gap-3 bg-gradient-to-l from-slate-900 to-emerald-900 px-4 py-3.5 text-white">
              <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold">تثبيت «شبكة» على جهازك</div>
                <div className="text-[11px] text-emerald-200">
                  {platform === "ios" ? "آيفون / آيباد — سفاري" : platform === "android" ? "أندرويد" : "حاسوب"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-sm hover:bg-white/20"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 px-4 py-4">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {i + 1}
                  </span>
                  <p className="text-[12.5px] leading-relaxed text-slate-700">
                    <span className="mr-1">{s.icon}</span>
                    {s.text}
                  </p>
                </div>
              ))}

              {canPrompt && (
                <button
                  onClick={install}
                  disabled={busy}
                  className="mt-1 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white shadow hover:bg-emerald-500 disabled:opacity-70"
                >
                  {busy ? "جارٍ التثبيت..." : "📲 تثبيت الآن"}
                </button>
              )}

              {platform === "ios" && (
                <p className="rounded-xl bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-800">
                  ملاحظة: على الآيفون يجب استخدام متصفح <b>سفاري</b>؛ التثبيت لا يعمل من كروم أو فيسبوك.
                </p>
              )}
              {platform === "android" && (
                <p className="rounded-xl bg-slate-50 p-2.5 text-[11.5px] leading-relaxed text-slate-600">
                  إن لم يظهر خيار التثبيت، افتح الموقع في <b>كروم</b> (لا من داخل فيسبوك/واتساب) وانتظر ثوانٍ حتى
                  يكتمل تحميل الصفحة.
                </p>
              )}

              <a
                href={APK_URL}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-bold text-slate-700 hover:bg-slate-50"
              >
                ⬇️ أو نزّل ملف APK (نسخة أندرويد الأصلية)
              </a>
              <p className="text-center text-[10.5px] leading-relaxed text-slate-400">
                نسخة APK تحتاج تفعيل «التثبيت من مصادر غير معروفة»، وتدعم إشعارات التحديث داخل التطبيق.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** زر «تثبيت» للشريط العلوي — يظهر فقط إن لم يكن التطبيق مثبّتاً */
export function InstallButton() {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [installed, setInstalled] = useState(() => isStandalone());
  const [canPrompt, setCanPrompt] = useState(() => !!getInstallPrompt());

  useEffect(() => {
    const update = () => {
      setInstalled(isStandalone());
      setCanPrompt(!!getInstallPrompt());
    };
    return subscribeInstall(update);
  }, []);

  if (installed || platform === "native") return null;

  return (
    <button
      onClick={async () => {
        if (canPrompt) await promptInstall();
        else window.dispatchEvent(new Event("shabka:open-install"));
      }}
      title="تثبيت التطبيق على الجهاز"
      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-400"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      <span className="hidden sm:inline">تثبيت</span>
    </button>
  );
}
