import { OPERATOR_BY_ID, TECHS, TECH_INFO, type OperatorId } from "../data/operators";
import { qualityLabel, type OperatorCoverage } from "../lib/coverage";
import { formatDistance } from "../lib/geo";

interface Props {
  coverage: OperatorCoverage[];
  enabledOps: Set<OperatorId>;
  loading?: boolean;
  onRefresh?: () => void;
  onFocusTower: (towerId: string, pos: [number, number]) => void;
}

function SignalBars({ percent, color }: { percent: number; color: string }) {
  const bars = percent >= 75 ? 4 : percent >= 50 ? 3 : percent >= 25 ? 2 : percent > 0 ? 1 : 0;
  return (
    <div className="flex h-4 items-end gap-[2px]">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className="w-[4px] rounded-sm"
          style={{ height: `${b * 25}%`, background: b <= bars ? color : "#e2e8f0" }}
        />
      ))}
    </div>
  );
}

export default function CoveragePanel({ coverage, enabledOps, loading = false, onRefresh, onFocusTower }: Props) {
  const visible = coverage.filter((c) => enabledOps.has(c.operatorId));
  const best = [...visible].sort((a, b) => {
    const score = (c: OperatorCoverage) =>
      c.techs["5G"].percent * 1.3 + c.techs["4G"].percent * 1.2 + c.techs["3G"].percent * 0.6 + c.techs["2G"].percent * 0.3;
    return score(b) - score(a);
  })[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white px-3 py-2 shadow-sm">
        <div>
          <div className="text-sm font-extrabold text-slate-800">تغطية الشبكات في هذه النقطة</div>
          <div className="text-[10px] text-slate-500">حدّث بيانات الأبراج ثم افحص توفر 4G وأقرب برج</div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            aria-label="تحديث الأبراج والتغطية"
          >
            <span className={loading ? "inline-block animate-spin" : "inline-block"} aria-hidden="true">↻</span>
            {loading ? "جارٍ التحديث" : "تحديث الأبراج"}
          </button>
        )}
      </div>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">هل توجد 4G هنا؟</h3>
            <p className="text-[10px] text-slate-500">التوفر والقرب محسوبان تقديرياً من بيانات الأبراج المتاحة</p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-blue-700">4G</span>
        </div>
        <div className="space-y-2">
          {visible.map((c) => {
            const op = OPERATOR_BY_ID[c.operatorId];
            const tech = c.techs["4G"];
            const candidate = tech.nearestTower;
            const status = !candidate
              ? "لا يوجد برج 4G مسجل هنا"
              : tech.percent >= 25
                ? "متوفرة تقديرياً"
                : "إشارة ضعيفة / غير مؤكدة";
            return (
              <div key={`4g-${c.operatorId}`} className="rounded-xl bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold" style={{ color: op.color }}>{op.name}</span>
                  <span className={`text-xs font-extrabold ${tech.percent >= 25 ? "text-emerald-700" : candidate ? "text-amber-700" : "text-slate-500"}`}>
                    {status} · {tech.percent}%
                  </span>
                </div>
                {candidate ? (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
                    <span>
                      أقرب برج 4G: <b>{formatDistance(candidate.distance)}</b>
                      {candidate.distance <= 5000
                        ? " · ضمن النطاق المحلي تقريباً"
                        : " · خارج النطاق المحلي تقريباً"}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700 hover:bg-slate-200"
                      onClick={() => onFocusTower(candidate.tower.id, [candidate.tower.lat, candidate.tower.lon])}
                    >
                      عرض البرج
                    </button>
                    <span className="w-full text-[10px] text-slate-400">
                      المصدر: {candidate.tower.source === "simulated" ? "تقديري" : candidate.tower.source === "csv" ? "ملف OpenCellID" : "OpenCellID"}
                      {candidate.tower.avgSignal ? ` · قياس مسجل ${candidate.tower.avgSignal} dBm` : " · قوة الإشارة تقديرية"}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] text-slate-500">عدم ظهور برج لا يثبت انعدام التغطية؛ قد تكون بيانات المنطقة ناقصة.</div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          «النطاق المحلي» هنا تقريب للمسافة (5 كم) وليس حدوداً إدارية للمدينة. بيانات التغطية ليست قياساً مباشراً من الهاتف.
        </p>
      </section>

      {best && best.overall > 0 && (
        <div className="rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-600 p-3 text-white shadow">
          <div className="text-xs opacity-90">أفضل شبكة في هذه النقطة</div>
          <div className="mt-0.5 flex items-center justify-between">
            <div className="text-lg font-extrabold">{OPERATOR_BY_ID[best.operatorId].name}</div>
            {best.bestTech && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-bold">
                {best.bestTech} • {best.techs[best.bestTech].percent}%
              </span>
            )}
          </div>
        </div>
      )}

      {visible.map((c) => {
        const op = OPERATOR_BY_ID[c.operatorId];
        return (
          <div key={c.operatorId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2" style={{ background: `${op.color}14` }}>
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white shadow"
                  style={{ background: op.color }}
                >
                  {op.name[0]}
                </span>
                <div>
                  <div className="font-bold leading-tight text-slate-800">{op.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {op.nameEn} • MNC {op.mnc.map((m) => m.toString().padStart(2, "0")).join("/")}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-xl font-black" style={{ color: qualityLabel(c.overall).color }}>
                  {c.overall}%
                </div>
                <div className="text-[10px] text-slate-500">أقصى تغطية</div>
              </div>
            </div>

            <div className="space-y-2 px-3 py-2.5">
              {TECHS.map((tech) => {
                const t = c.techs[tech];
                const q = qualityLabel(t.percent);
                const info = TECH_INFO[tech];
                return (
                  <div key={tech} className="flex items-center gap-2">
                    <span
                      className="w-9 shrink-0 rounded-md py-0.5 text-center text-xs font-black text-white"
                      style={{ background: t.percent > 0 ? info.color : "#cbd5e1" }}
                    >
                      {tech}
                    </span>
                    <div className="flex-1">
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${t.percent}%`, background: info.color }}
                        />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
                        <span style={{ color: q.color }}>{q.label}</span>
                        <span dir="ltr">
                          {t.dbm !== null ? `${t.dbm} dBm` : "—"}
                          {t.towers > 0 ? ` · ${t.towers} برج` : ""}
                        </span>
                      </div>
                    </div>
                    <SignalBars percent={t.percent} color={info.color} />
                    <span className="w-10 shrink-0 text-left text-sm font-bold tabular-nums text-slate-700">
                      {t.percent}%
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
              {c.nearestTower ? (
                <>
                  <span>
                    أقرب برج: <b>{formatDistance(c.nearestTower.distance)}</b>
                  </span>
                  <button
                    className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200"
                    onClick={() =>
                      onFocusTower(c.nearestTower!.tower.id, [c.nearestTower!.tower.lat, c.nearestTower!.tower.lon])
                    }
                  >
                    عرض على الخريطة
                  </button>
                </>
              ) : (
                <span>لا توجد أبراج معروفة في المنطقة</span>
              )}
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="rounded-xl bg-slate-100 p-4 text-center text-sm text-slate-500">
          اختر شبكة واحدة على الأقل من الفلاتر
        </div>
      )}
    </div>
  );
}
