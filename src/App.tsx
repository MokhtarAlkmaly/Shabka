import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { type BaseLayer } from "./components/MapView";
import CoveragePanel from "./components/CoveragePanel";
import TaizCoverage from "./components/TaizCoverage";
import { TAIZ_OPERATORS } from "./data/taiz";
import SettingsModal from "./components/SettingsModal";
import UpdateBanner from "./components/UpdateBanner";
import {
  DEFAULT_CENTER,
  DEFAULT_CITY,
  OPERATORS,
  TECHS,
  TECH_INFO,
  type OperatorId,
  type Tech,
} from "./data/operators";
import { computeCoverage } from "./lib/coverage";
import { haversine, type LatLon } from "./lib/geo";
import {
  fetchOpenCellId,
  generateSimulatedTowers,
  parseCellCsv,
  type DataSource,
  type Tower,
} from "./lib/towers";
import { useConnection } from "./hooks/useConnection";
import { idbGet, idbSet } from "./lib/store";
import { trimTileCache } from "./lib/tileCache";

const LS_SOURCE = "ytc_source";
const LS_KEY = "ytc_ocid_key";
const IDB_CSV = "csv_towers";
const IDB_CSV_INFO = "csv_info";

const ENV_KEY = import.meta.env.VITE_OPENCELLID_KEY ?? "";

function initialSource(): DataSource {
  const s = localStorage.getItem(LS_SOURCE) as DataSource | null;
  if (s === "opencellid" || s === "simulated" || s === "csv") return s;
  return ENV_KEY ? "opencellid" : "simulated";
}

const SOURCE_LABEL: Record<DataSource, string> = {
  simulated: "بيانات تقديرية",
  opencellid: "OpenCellID مباشر",
  csv: "ملف OpenCellID",
};

export default function App() {
  const [userPos, setUserPos] = useState<LatLon | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"pending" | "ok" | "denied" | "unsupported">("pending");
  const [analysisPoint, setAnalysisPoint] = useState<LatLon | null>(DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState<LatLon>(DEFAULT_CENTER);
  const [fetchCenter, setFetchCenter] = useState<LatLon>(DEFAULT_CENTER);
  const [flyTarget, setFlyTarget] = useState<{ pos: LatLon; zoom?: number; nonce: number } | null>(null);

  const [source, setSource] = useState<DataSource>(initialSource);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(LS_KEY) || ENV_KEY);
  const [apiTowers, setApiTowers] = useState<Map<string, Tower>>(new Map());
  const [csvTowers, setCsvTowers] = useState<Tower[]>([]);
  const [csvInfo, setCsvInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [notice, setNotice] = useState<{ text: string; type: "info" | "error" } | null>(null);

  const [enabledOps, setEnabledOps] = useState<Set<OperatorId>>(new Set(TAIZ_OPERATORS));
  const [enabledTechs, setEnabledTechs] = useState<Set<Tech>>(new Set(TECHS));
  const [circleTech, setCircleTech] = useState<Tech | null>("4G");
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("streets");
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);

  const connection = useConnection();
  // التطبيق يفتح دائماً على تعز، ولا يتبع GPS إلا بعد الضغط على «موقعي»
  const manualPoint = useRef(true);

  /* ---------------- استعادة البيانات المحفوظة (بدون إنترنت) ---------------- */
  useEffect(() => {
    trimTileCache().catch(() => {});
    Promise.all([idbGet<Tower[]>(IDB_CSV), idbGet<string>(IDB_CSV_INFO)])
      .then(([towers, info]) => {
        if (towers && towers.length) {
          setCsvTowers(towers);
          setCsvInfo(info ?? `ملف محفوظ: ${towers.length.toLocaleString("ar")} برج.`);
        } else {
          setSource((s) => (s === "csv" ? "simulated" : s));
        }
      })
      .catch(() => setSource((s) => (s === "csv" ? "simulated" : s)));
  }, []);

  /* ---------------- تحديد الموقع ---------------- */
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: LatLon = [p.coords.latitude, p.coords.longitude];
        setUserPos(pos);
        setAccuracy(p.coords.accuracy);
        setGeoStatus("ok");
        manualPoint.current = false;
        setAnalysisPoint(pos);
        setFetchCenter(pos);
        setFlyTarget({ pos, zoom: 15, nonce: Date.now() });
      },
      () => {
        setGeoStatus("denied");
        setNotice({ text: "تعذر تحديد موقعك. فعّل إذن الموقع في المتصفح (يتطلب HTTPS).", type: "error" });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos: LatLon = [p.coords.latitude, p.coords.longitude];
        setUserPos(pos);
        setAccuracy(p.coords.accuracy);
        setGeoStatus("ok");
        if (!manualPoint.current) setAnalysisPoint(pos);
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* ---------------- جلب الأبراج ---------------- */
  useEffect(() => {
    if (source !== "opencellid" || !apiKey) return;
    if (!navigator.onLine) {
      setNotice({ text: "لا يوجد اتصال بالإنترنت. OpenCellID يحتاج إنترنت — استخدم ملف OpenCellID أو البيانات التقديرية.", type: "error" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOpenCellId(apiKey, fetchCenter)
      .then((list) => {
        if (cancelled) return;
        setApiTowers((prev) => {
          const m = new Map(prev);
          list.forEach((t) => m.set(t.id, t));
          return m;
        });
        if (list.length === 0) setNotice({ text: "لم يتم العثور على أبراج مسجلة في OpenCellID لهذه المنطقة.", type: "info" });
      })
      .catch((e: Error) => {
        if (!cancelled) setNotice({ text: `خطأ OpenCellID: ${e.message}`, type: "error" });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, apiKey, fetchCenter, connection.online, refreshNonce]);

  const allTowers: Tower[] = useMemo(() => {
    if (source === "simulated") return generateSimulatedTowers(fetchCenter, 8);
    if (source === "opencellid") return [...apiTowers.values()];
    // CSV: الأبراج ضمن 20 كم من مركز الخريطة
    return csvTowers
      .map((t) => ({ t, d: haversine(mapCenter, [t.lat, t.lon]) }))
      .filter((x) => x.d < 20000)
      .sort((a, b) => a.d - b.d)
      .slice(0, 1500)
      .map((x) => x.t);
  }, [source, fetchCenter, apiTowers, csvTowers, mapCenter]);

  const visibleTowers = useMemo(
    () =>
      allTowers.filter(
        (t) => enabledOps.has(t.operatorId) && t.techs.some((tech) => enabledTechs.has(tech))
      ),
    [allTowers, enabledOps, enabledTechs]
  );

  const point = analysisPoint ?? mapCenter;
  const coverage = useMemo(() => computeCoverage(point, allTowers), [point, allTowers]);

  /* ---------------- أحداث الخريطة ---------------- */
  const onMoveEnd = useCallback(
    (c: LatLon) => {
      setMapCenter(c);
      const threshold = source === "opencellid" ? 1500 : 3000;
      setFetchCenter((fc) => (haversine(fc, c) > threshold ? c : fc));
    },
    [source]
  );

  const onMapClick = useCallback((p: LatLon) => {
    manualPoint.current = true;
    setAnalysisPoint(p);
    setSelectedTowerId(null);
    setPanelExpanded(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  const toggleOp = (id: OperatorId) =>
    setEnabledOps((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleTech = (t: Tech) =>
    setEnabledTechs((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    allTowers.forEach((t) => (c[t.operatorId] = (c[t.operatorId] ?? 0) + 1));
    return c;
  }, [allTowers]);

  const goToDefaultCity = () => {
    manualPoint.current = true;
    setAnalysisPoint(DEFAULT_CENTER);
    setFetchCenter(DEFAULT_CENTER);
    setFlyTarget({ pos: DEFAULT_CENTER, zoom: 14, nonce: Date.now() });
  };

  const useMyLocation = () => {
    if (userPos) {
      manualPoint.current = false;
      setAnalysisPoint(userPos);
      setFetchCenter(userPos);
      setFlyTarget({ pos: userPos, zoom: 15, nonce: Date.now() });
    } else locate();
  };

  const refreshCoverage = () => {
    const target = analysisPoint ?? mapCenter;
    setMapCenter(target);
    setFetchCenter(target);
    if (source === "opencellid") {
      if (!apiKey) {
        setNotice({ text: "أضف مفتاح OpenCellID من زر «مصدر البيانات» لتحديث الأبراج الحقيقية.", type: "error" });
        return;
      }
      if (!connection.online) {
        setNotice({ text: "تحديث OpenCellID يحتاج اتصالاً بالإنترنت. يمكنك تحليل ملف الأبراج المحفوظ أو البيانات التقديرية.", type: "error" });
        return;
      }
      setRefreshNonce((n) => n + 1);
      return;
    }
    setNotice({
      text: source === "csv"
        ? "تم تحديث التحليل من ملف الأبراج المحفوظ."
        : "تم تحديث التغطية التقديرية لهذه النقطة؛ هذه البيانات ليست مواقع أبراج مؤكدة.",
      type: "info",
    });
  };

  return (
    <div dir="rtl" className="flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-800">
      {/* الشريط العلوي */}
      <header className="z-[1001] flex items-center justify-between gap-2 bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-900 px-3 py-2.5 text-white shadow-lg sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/90 shadow-inner">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" /><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" /><circle cx="12" cy="9" r="2" />
              <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47" /><path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1" /><path d="M9.5 18h5" /><path d="m8 22 4-11 4 11" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-extrabold leading-tight sm:text-lg">خريطة تغطية شبكات اليمن</h1>
            <p className="text-[11px] text-emerald-200 sm:text-xs">يمن موبايل • يو • سبأفون • واي — 2G / 3G / 4G / 5G</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-block ${
              source === "simulated" ? "bg-amber-400/20 text-amber-200" : "bg-emerald-400/20 text-emerald-200"
            }`}
          >
            {loading ? "جارٍ التحميل..." : SOURCE_LABEL[source]}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" />
            </svg>
            <span className="hidden sm:inline">مصدر البيانات</span>
          </button>
        </div>
      </header>

      <UpdateBanner />

      {!connection.online && (
        <div className="z-[1000] bg-slate-700 px-3 py-1.5 text-center text-[11px] text-white sm:text-xs">
          📴 أنت بدون إنترنت — تظهر الخرائط التي تصفحتها سابقاً فقط، والأبراج من البيانات التقديرية أو الملف المحفوظ.
        </div>
      )}

      {source === "simulated" && (
        <div className="z-[1000] bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-800 sm:text-xs">
          ⚠️ تعرض الآن بيانات تقديرية للتجربة.{" "}
          <button onClick={() => setSettingsOpen(true)} className="font-bold underline">
            اربط OpenCellID
          </button>{" "}
          لعرض مواقع الأبراج الحقيقية.
        </div>
      )}

      <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* اللوحة الجانبية */}
        <aside
          className={`order-2 z-[1000] flex flex-col border-slate-200 bg-slate-50 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] transition-[max-height] duration-300 lg:order-1 lg:max-h-none lg:w-[400px] lg:border-l lg:shadow-xl ${
            panelExpanded ? "max-h-[55vh]" : "max-h-[64px]"
          }`}
        >
          <button
            className="flex w-full items-center justify-between px-4 py-2.5 lg:hidden"
            onClick={() => setPanelExpanded((v) => !v)}
          >
            <span className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
          </button>
          <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 pb-4 lg:pt-3">
            {/* نقطة التحليل */}
            <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
              <div>
                <div className="text-xs text-slate-500">
                  {point[0] === DEFAULT_CENTER[0] && point[1] === DEFAULT_CENTER[1]
                    ? `🏙️ ${DEFAULT_CITY} (الموقع الافتراضي)`
                    : manualPoint.current
                      ? "📍 نقطة مختارة على الخريطة"
                      : geoStatus === "ok"
                        ? "📡 موقعك الحالي"
                        : "📍 مركز الخريطة"}
                </div>
                <div dir="ltr" className="text-right font-mono text-sm font-semibold text-slate-700">
                  {point[0].toFixed(5)}, {point[1].toFixed(5)}
                </div>
                {accuracy && !manualPoint.current && geoStatus === "ok" && (
                  <div className="text-[10px] text-slate-400">دقة الموقع ±{Math.round(accuracy)} م</div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={goToDefaultCity}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                >
                  {DEFAULT_CITY}
                </button>
                <button
                  onClick={useMyLocation}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                >
                  موقعي
                </button>
              </div>
            </div>

            {/* الفلاتر */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="mb-2 text-xs font-bold text-slate-500">الشبكات</div>
              <div className="flex flex-wrap gap-1.5">
                {OPERATORS.map((o) => {
                  const on = enabledOps.has(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOp(o.id)}
                      className="flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold transition"
                      style={{
                        borderColor: o.color,
                        background: on ? o.color : "white",
                        color: on ? "white" : o.color,
                      }}
                    >
                      {o.name}
                      <span className={`rounded-full px-1.5 text-[10px] ${on ? "bg-white/25" : "bg-slate-100"}`}>
                        {counts[o.id] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mb-2 mt-3 text-xs font-bold text-slate-500">التقنيات</div>
              <div className="flex flex-wrap gap-1.5">
                {TECHS.map((t) => {
                  const on = enabledTechs.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTech(t)}
                      title={TECH_INFO[t].desc}
                      className="rounded-lg border-2 px-3 py-1 text-xs font-black transition"
                      style={{
                        borderColor: TECH_INFO[t].color,
                        background: on ? TECH_INFO[t].color : "white",
                        color: on ? "white" : TECH_INFO[t].color,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <TaizCoverage
              source={source}
              towers={source === "csv" ? csvTowers : allTowers}
              loading={loading}
              onSelect={(place) => {
                manualPoint.current = true;
                setAnalysisPoint(place.center);
                setMapCenter(place.center);
                setFetchCenter(place.center);
                setEnabledOps(new Set(TAIZ_OPERATORS));
                setSelectedTowerId(null);
                setFlyTarget({ pos: place.center, zoom: 15, nonce: Date.now() });
              }}
            />

            <CoveragePanel
              coverage={coverage}
              enabledOps={enabledOps}
              loading={loading}
              onRefresh={refreshCoverage}
              onFocusTower={(id, pos) => {
                setSelectedTowerId(id);
                setFlyTarget({ pos, zoom: 16, nonce: Date.now() });
              }}
            />

            {/* اتصال الجهاز */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="mb-2 text-xs font-bold text-slate-500">اتصال جهازك الحالي</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500">الحالة</div>
                  <div className={`text-sm font-bold ${connection.online ? "text-emerald-600" : "text-red-600"}`}>
                    {connection.online ? "متصل" : "غير متصل"}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500">النوع الفعّال</div>
                  <div className="text-sm font-bold uppercase">{connection.effectiveType ?? "—"}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500">السرعة</div>
                  <div className="text-sm font-bold" dir="ltr">
                    {connection.downlink != null ? `${connection.downlink} Mb/s` : "—"}
                  </div>
                </div>
              </div>
              {!connection.supported && (
                <p className="mt-2 text-[10px] text-slate-400">متصفحك لا يدعم قراءة معلومات الشبكة (مدعوم في Chrome على Android).</p>
              )}
            </div>

            <p className="px-1 text-[10px] leading-relaxed text-slate-400">
              * النسب المئوية محسوبة بنموذج انتشار إشارة تقديري حسب المسافة من الأبراج ونطاق كل تقنية، وليست قياساً فعلياً.
              اضغط على أي نقطة في الخريطة لتحليل التغطية فيها.
            </p>
          </div>
        </aside>

        {/* الخريطة */}
        <main className="relative order-1 flex-1 lg:order-2">
          <MapView
            initialCenter={DEFAULT_CENTER}
            userPos={userPos}
            accuracy={accuracy}
            analysisPoint={analysisPoint}
            towers={visibleTowers}
            circleTech={circleTech && enabledTechs.has(circleTech) ? circleTech : null}
            baseLayer={baseLayer}
            selectedTowerId={selectedTowerId}
            flyTarget={flyTarget}
            onMapClick={onMapClick}
            onMoveEnd={onMoveEnd}
            onSelectTower={setSelectedTowerId}
          />

          {/* أدوات الخريطة */}
          <div className="pointer-events-none absolute left-3 top-3 z-[999] flex flex-col gap-2">
            <button
              onClick={locate}
              title="تحديد موقعي"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-lg hover:bg-blue-50"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" />
              </svg>
            </button>
            <div className="pointer-events-auto flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
              {(["streets", "light", "satellite"] as BaseLayer[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBaseLayer(b)}
                  className={`px-2 py-2 text-[11px] font-bold ${baseLayer === b ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {b === "streets" ? "شوارع" : b === "light" ? "فاتح" : "قمر صناعي"}
                </button>
              ))}
            </div>
          </div>

          {/* نطاق التغطية */}
          <div className="absolute right-3 top-3 z-[999] rounded-2xl bg-white/95 p-2 shadow-lg backdrop-blur">
            <div className="mb-1 px-1 text-[10px] font-bold text-slate-500">دوائر التغطية</div>
            <div className="flex gap-1">
              {TECHS.map((t) => (
                <button
                  key={t}
                  onClick={() => setCircleTech((c) => (c === t ? null : t))}
                  className="rounded-lg px-2 py-1 text-[11px] font-black transition"
                  style={{
                    background: circleTech === t ? TECH_INFO[t].color : "#f1f5f9",
                    color: circleTech === t ? "white" : "#475569",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* عدد الأبراج */}
          <div className="absolute bottom-3 right-3 z-[999] rounded-xl bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-white shadow">
            {loading ? "⏳ جارٍ جلب الأبراج..." : `📡 ${visibleTowers.length} برج ظاهر`}
          </div>

          {notice && (
            <div
              className={`absolute inset-x-3 bottom-14 z-[1000] mx-auto max-w-md rounded-xl px-4 py-2.5 text-center text-sm font-semibold shadow-xl ${
                notice.type === "error" ? "bg-red-600 text-white" : "bg-slate-800 text-white"
              }`}
              onClick={() => setNotice(null)}
            >
              {notice.text}
            </div>
          )}
        </main>
      </div>

      {settingsOpen && (
        <SettingsModal
          open
          source={source}
          apiKey={apiKey}
          csvInfo={csvInfo}
          onClose={() => setSettingsOpen(false)}
          onCsvFile={async (file) => {
            const towers = await parseCellCsv(file);
            const info = `تم تحميل ${towers.length.toLocaleString("ar")} برج من الملف "${file.name}" (محفوظ للعمل بدون إنترنت).`;
            setCsvTowers(towers);
            setCsvInfo(info);
            idbSet(IDB_CSV, towers).catch(() => {});
            idbSet(IDB_CSV_INFO, info).catch(() => {});
          }}
          onApply={(src, key) => {
            setSource(src);
            localStorage.setItem(LS_SOURCE, src);
            if (src === "opencellid") {
              setApiKey(key);
              localStorage.setItem(LS_KEY, key);
              setApiTowers(new Map());
              setFetchCenter([mapCenter[0], mapCenter[1]]);
            }
            setSettingsOpen(false);
            setNotice({ text: `تم التبديل إلى: ${SOURCE_LABEL[src]}`, type: "info" });
          }}
        />
      )}
    </div>
  );
}
