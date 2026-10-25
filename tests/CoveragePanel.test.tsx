import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import CoveragePanel from "../src/components/CoveragePanel";
import { OPERATORS, TECHS } from "../src/data/operators";
import { computeCoverage } from "../src/lib/coverage";
import { generateSimulatedTowers } from "../src/lib/towers";
import { DEFAULT_CENTER } from "../src/data/operators";
import { haversine } from "../src/lib/geo";

const allOps = new Set(OPERATORS.map((o) => o.id));

const render = (towers: ReturnType<typeof generateSimulatedTowers>, onRefresh?: () => void) =>
  renderToStaticMarkup(
    <CoveragePanel
      coverage={computeCoverage(DEFAULT_CENTER, towers)}
      enabledOps={allOps}
      loading={false}
      onRefresh={onRefresh}
      onFocusTower={() => {}}
    />
  );

// نقطة بلا أي أبراج: يجب أن تظهر رسالة واضحة لكل مشغل بدل الادعاء بانعدام التغطية.
const empty = render([], () => {});
assert.ok(empty.includes("هل توجد 4G هنا؟"), "Missing 4G section");
assert.ok(empty.includes("تحديث الأبراج"), "Missing refresh button");
assert.equal((empty.match(/لا يوجد برج 4G مسجل هنا/g) ?? []).length, OPERATORS.length);
assert.ok(empty.includes("عدم ظهور برج لا يثبت انعدام التغطية"));

// نقطة وسط أبراج مولّدة: يجب اختيار أقرب برج 4G لكل تقنية مع المصدر والمسافة.
const towers = generateSimulatedTowers(DEFAULT_CENTER, 8);
assert.ok(towers.some((t) => t.techs.includes("4G")), "Simulated towers should include 4G");
const near = render(towers);
assert.ok(near.includes("أقرب برج 4G:"), "Missing nearest 4G tower line");
assert.ok(near.includes("عرض البرج"), "Missing focus button");
assert.ok(near.includes("المصدر: تقديري"), "Missing source label");
assert.ok(near.includes("ضمن النطاق المحلي تقريباً") || near.includes("خارج النطاق المحلي تقريباً"));
assert.ok(near.includes("5 كم"), "Missing local-radius disclaimer");

// أقرب برج 4G فعلياً هو الأقرب بين أبراج المشغل الداعمة لـ4G.
const cov = computeCoverage(DEFAULT_CENTER, towers);
for (const op of cov) {
  const candidate = op.techs["4G"].nearestTower;
  if (!candidate) continue;
  assert.ok(candidate.tower.techs.includes("4G"), "Nearest 4G tower must support 4G");
  const opTowers = towers.filter((t) => t.operatorId === op.operatorId && t.techs.includes("4G"));
  const min = Math.min(...opTowers.map((t) => haversine(DEFAULT_CENTER, [t.lat, t.lon])));
  assert.ok(Math.abs(candidate.distance - min) < 0.001, "Should pick the closest 4G tower");
  assert.ok(TECHS.includes("4G"));
}
console.log("Coverage panel: all assertions passed");
