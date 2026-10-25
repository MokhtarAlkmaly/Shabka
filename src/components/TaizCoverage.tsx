import { useMemo } from "react";
import { OPERATOR_BY_ID, type Tech } from "../data/operators";
import { TAIZ_OPERATORS, TAIZ_SECTIONS, type TaizPlace } from "../data/taiz";
import { computeCoverage, qualityLabel } from "../lib/coverage";
import { haversine } from "../lib/geo";
import { generateSimulatedTowers, type DataSource, type Tower } from "../lib/towers";

interface Props {
  source: DataSource;
  towers: Tower[];
  loading: boolean;
  onSelect: (place: TaizPlace) => void;
}

const DISPLAY_TECHS: Tech[] = ["4G", "3G", "2G"];

export default function TaizCoverage({ source, towers, loading, onSelect }: Props) {
  const sections = useMemo(() => TAIZ_SECTIONS.map((section) => ({
    ...section,
    places: section.places.map((place) => {
      // لا نستخدم أبراج مركز الخريطة لتخمين قوة منطقة بعيدة.
      const nearby = source === "simulated"
        ? generateSimulatedTowers(place.center, 8)
        : towers.filter((t) => haversine(place.center, [t.lat, t.lon]) < 20000);
      return { ...place, coverage: computeCoverage(place.center, nearby) };
    }),
  })), [source, towers]);

  return (
    <section aria-label="مقارنة تغطية مناطق تعز" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="font-extrabold text-slate-800">تغطية مناطق تعز</h2>
      <p className="text-xs leading-relaxed text-slate-500">
        يمن موبايل ويو فقط. المقارنة عند نقاط مرجعية تقريبية، وليست حكماً على المنطقة كلها.
        اختر «تحليل على الخريطة» ثم اضغط موقعك الدقيق لعرض تفاصيل الأبراج.
      </p>
      <p className="rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-amber-800" role="note">
        {source === "simulated"
          ? "بيانات تجريبية مولّدة وليست تغطية فعلية. النسب وقراءات dBm تقديرية ولا تقيس إشارة هاتفك."
          : "تقدير من الأبراج المتاحة، وليس قياساً مباشراً. غياب البيانات لا يعني انعدام التغطية، ولا يثبت توفر الخدمة حالياً."}
        {source === "opencellid" && " لتحميل أبراج منطقة أخرى اضغط «تحليل على الخريطة»."}
      </p>
      {loading && <p role="status" className="text-xs text-sky-700">جارٍ تحميل بيانات الأبراج…</p>}
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`taiz-${section.id}`} className="space-y-2 border-t border-slate-100 pt-3">
          <h3 id={`taiz-${section.id}`} className="text-sm font-bold text-slate-700">{section.title}</h3>
          {section.places.map((place) => (
            <article key={place.id} className="space-y-2 rounded-xl bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold">{place.name} <span className="text-[10px] font-normal text-slate-500">(نقطة تقريبية)</span></h4>
                <button type="button" onClick={() => onSelect(place)} aria-label={`تحليل ${place.name} على الخريطة`}
                  className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800 hover:bg-sky-200">
                  تحليل على الخريطة
                </button>
              </div>
              {TAIZ_OPERATORS.map((id) => {
                const op = OPERATOR_BY_ID[id];
                const c = place.coverage.find((item) => item.operatorId === id)!;
                return (
                  <div key={id} className="rounded-lg border border-slate-200 bg-white p-2">
                    <div className="mb-1 text-xs font-bold" style={{ color: op.color }}>{op.name}</div>
                    {!c.nearestTower ? (
                      <p className="text-xs text-slate-500">لا تتوفر بيانات أبراج قريبة لهذه الشبكة.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1 text-center">
                        {DISPLAY_TECHS.map((tech) => {
                          const t = c.techs[tech];
                          const q = qualityLabel(t.percent);
                          return (
                            <div key={tech} className="rounded bg-slate-50 p-1 text-[11px]">
                              <div className="font-bold">{tech}</div>
                              {t.nearest === null ? <div className="text-slate-500">لا توجد بيانات</div> : <>
                                <div style={{ color: q.color }}>{t.percent.toLocaleString("ar")}٪ · {q.label}</div>
                                <div dir="ltr" className="text-[10px] text-slate-500">{t.dbm !== null ? `${t.dbm} dBm` : "—"}</div>
                              </>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </article>
          ))}
        </section>
      ))}
    </section>
  );
}
