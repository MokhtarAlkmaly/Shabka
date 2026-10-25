import { OPERATOR_BY_ID, TECHS, TECH_INFO, type OperatorId } from "../data/operators";
import { qualityLabel, type OperatorCoverage } from "../lib/coverage";
import { formatDistance } from "../lib/geo";

interface Props {
  coverage: OperatorCoverage[];
  enabledOps: Set<OperatorId>;
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

export default function CoveragePanel({ coverage, enabledOps, onFocusTower }: Props) {
  const visible = coverage.filter((c) => enabledOps.has(c.operatorId));
  const best = [...visible].sort((a, b) => {
    const score = (c: OperatorCoverage) =>
      c.techs["5G"].percent * 1.3 + c.techs["4G"].percent * 1.2 + c.techs["3G"].percent * 0.6 + c.techs["2G"].percent * 0.3;
    return score(b) - score(a);
  })[0];

  return (
    <div className="space-y-3">
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
