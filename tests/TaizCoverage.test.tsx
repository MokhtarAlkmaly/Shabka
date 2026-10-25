import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import TaizCoverage from "../src/components/TaizCoverage";
import { TAIZ_SECTIONS } from "../src/data/taiz";
import { generateSimulatedTowers } from "../src/lib/towers";

const render = (source: "csv" | "simulated" | "opencellid", towers = [] as ReturnType<typeof generateSimulatedTowers>) =>
  renderToStaticMarkup(<TaizCoverage source={source} towers={towers} loading={false} onSelect={() => {}} />);

const empty = render("csv");
for (const name of ["مدينة تعز", "شارع جمال", "الحوبان", "شرعب الرونة", "يمن موبايل", "يو"]) {
  assert.ok(empty.includes(name), `Missing ${name}`);
}
assert.equal((empty.match(/لا تتوفر بيانات أبراج قريبة/g) ?? []).length, 6);
assert.ok(!empty.includes("سبأفون"));
assert.ok(!empty.includes("5G"));
const simulated = render("simulated");
assert.ok(simulated.includes("بيانات تجريبية مولّدة"));
assert.ok(simulated.includes("dBm"));
assert.ok(!simulated.includes("لا تتوفر بيانات أبراج قريبة"));

// بيانات المدينة لا تتحول إلى حكم بانعدام التغطية في شرعب البعيدة.
const cityTowers = generateSimulatedTowers(TAIZ_SECTIONS[0].places[0].center, 8);
const partial = render("opencellid", cityTowers);
assert.ok(partial.includes("لا تتوفر بيانات أبراج قريبة"));
assert.ok(partial.includes("لتحميل أبراج منطقة أخرى"));
console.log("Taiz coverage: all assertions passed");
