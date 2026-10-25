import {
  OPERATORS,
  TECHS,
  YEMEN_MCC,
  operatorFromMnc,
  radioToTech,
  type OperatorId,
  type Tech,
} from "../data/operators";
import { haversine, type LatLon } from "./geo";

export type DataSource = "simulated" | "opencellid" | "csv";

export interface Tower {
  id: string;
  lat: number;
  lon: number;
  operatorId: OperatorId;
  techs: Tech[];
  /** نطاق تقديري بالمتر لكل تقنية إن توفر */
  ranges: Partial<Record<Tech, number>>;
  source: DataSource;
  cells: number;
  samples?: number;
  avgSignal?: number;
  lac?: number;
  cellIds?: number[];
  updated?: number;
}

/* ---------------------------------------------------------------- */
/*                         بيانات تقديرية                            */
/* ---------------------------------------------------------------- */

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID = 0.012; // ~1.3 كم

/**
 * توليد أبراج تقديرية ثابتة (حتمية) حول نقطة معينة.
 * نفس المنطقة تُنتج دائماً نفس الأبراج.
 */
export function generateSimulatedTowers(center: LatLon, radiusKm = 8): Tower[] {
  const towers: Tower[] = [];
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((center[0] * Math.PI) / 180));
  const gy0 = Math.floor((center[0] - dLat) / GRID);
  const gy1 = Math.floor((center[0] + dLat) / GRID);
  const gx0 = Math.floor((center[1] - dLon) / GRID);
  const gx1 = Math.floor((center[1] + dLon) / GRID);

  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      for (const op of OPERATORS) {
        const rnd = mulberry32(hashString(`${gy}:${gx}:${op.id}`));
        if (rnd() > op.density) continue;
        const lat = (gy + 0.1 + rnd() * 0.8) * GRID;
        const lon = (gx + 0.1 + rnd() * 0.8) * GRID;
        if (haversine(center, [lat, lon]) > radiusKm * 1000) continue;
        const techs = TECHS.filter((t) => rnd() < op.techProb[t]);
        if (techs.length === 0) techs.push(op.techProb["2G"] > op.techProb["3G"] ? "2G" : "3G");
        towers.push({
          id: `sim-${op.id}-${gy}-${gx}`,
          lat,
          lon,
          operatorId: op.id,
          techs,
          ranges: {},
          source: "simulated",
          cells: techs.length * (1 + Math.floor(rnd() * 3)),
        });
      }
    }
  }
  return towers;
}

/* ---------------------------------------------------------------- */
/*                         OpenCellID                                */
/* ---------------------------------------------------------------- */

export interface RawCell {
  radio: string;
  mcc: number;
  mnc: number;
  lac: number;
  cellid: number;
  lat: number;
  lon: number;
  range?: number;
  samples?: number;
  averageSignal?: number;
  updated?: number;
}

/** دمج الخلايا (Cells) المتقاربة لنفس المشغل في برج واحد */
export function groupCellsIntoTowers(cells: RawCell[], source: DataSource): Tower[] {
  const map = new Map<string, Tower>();
  for (const c of cells) {
    if (c.mcc !== YEMEN_MCC) continue;
    const op = operatorFromMnc(c.mnc);
    const tech = radioToTech(c.radio);
    if (!op || !tech || !isFinite(c.lat) || !isFinite(c.lon)) continue;
    // تقريب ~ 30 متر لتجميع الخلايا في نفس الموقع
    const key = `${op.id}:${c.lat.toFixed(3)}:${c.lon.toFixed(3)}`;
    let t = map.get(key);
    if (!t) {
      t = {
        id: `${source}-${key}`,
        lat: c.lat,
        lon: c.lon,
        operatorId: op.id,
        techs: [],
        ranges: {},
        source,
        cells: 0,
        samples: 0,
        lac: c.lac,
        cellIds: [],
      };
      map.set(key, t);
    }
    t.cells++;
    t.samples = (t.samples ?? 0) + (c.samples ?? 0);
    if (t.cellIds && t.cellIds.length < 12) t.cellIds.push(c.cellid);
    if (!t.techs.includes(tech)) t.techs.push(tech);
    if (c.range && c.range > 0) t.ranges[tech] = Math.max(t.ranges[tech] ?? 0, c.range);
    if (c.averageSignal && c.averageSignal < 0) t.avgSignal = c.averageSignal;
    if (c.updated) t.updated = Math.max(t.updated ?? 0, c.updated);
  }
  const order = (x: Tech) => TECHS.indexOf(x);
  return [...map.values()].map((t) => ({ ...t, techs: t.techs.sort((a, b) => order(a) - order(b)) }));
}

/**
 * جلب الأبراج من OpenCellID API حول نقطة.
 * الحد الأقصى لمساحة BBOX هو 4 كم² لذلك نقسم المنطقة إلى 4 مربعات.
 */
export async function fetchOpenCellId(key: string, center: LatLon): Promise<Tower[]> {
  const step = 0.017; // ~1.9 كم
  const stepLon = step / Math.cos((center[0] * Math.PI) / 180);
  const boxes: [number, number, number, number][] = [];
  for (const i of [-1, 0]) {
    for (const j of [-1, 0]) {
      const latMin = center[0] + i * step;
      const lonMin = center[1] + j * stepLon;
      boxes.push([latMin, lonMin, latMin + step, lonMin + stepLon]);
    }
  }

  const results = await Promise.allSettled(
    boxes.map(async (b) => {
      const url =
        `https://opencellid.org/cell/getInArea?key=${encodeURIComponent(key)}` +
        `&BBOX=${b.map((x) => x.toFixed(6)).join(",")}&mcc=${YEMEN_MCC}&limit=50&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const cells: RawCell[] = (json.cells ?? []).map((c: Record<string, unknown>) => ({
        radio: String(c.radio ?? ""),
        mcc: Number(c.mcc),
        mnc: Number(c.mnc),
        lac: Number(c.lac),
        cellid: Number(c.cellid),
        lat: Number(c.lat),
        lon: Number(c.lon),
        range: Number(c.range) || undefined,
        samples: Number(c.samples) || undefined,
        averageSignal: Number(c.averageSignalStrength) || undefined,
      }));
      return cells;
    })
  );

  const ok = results.filter((r): r is PromiseFulfilledResult<RawCell[]> => r.status === "fulfilled");
  if (ok.length === 0) {
    const first = results[0] as PromiseRejectedResult;
    throw new Error(first?.reason?.message ?? "فشل الاتصال بـ OpenCellID");
  }
  return groupCellsIntoTowers(ok.flatMap((r) => r.value), "opencellid");
}

/* ---------------------------------------------------------------- */
/*                   استيراد ملف CSV (OpenCellID)                    */
/* ---------------------------------------------------------------- */

const DEFAULT_COLUMNS = [
  "radio", "mcc", "net", "area", "cell", "unit", "lon", "lat",
  "range", "samples", "changeable", "created", "updated", "averageSignal",
];

async function readFileText(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".gz")) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("المتصفح لا يدعم فك ضغط gz. فك الضغط أولاً ثم ارفع ملف CSV.");
    }
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return await file.text();
}

export async function parseCellCsv(file: File): Promise<Tower[]> {
  const text = await readFileText(file);
  const lines = text.split(/\r?\n/);
  let cols = DEFAULT_COLUMNS;
  let start = 0;
  if (lines[0] && /radio/i.test(lines[0])) {
    cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
    start = 1;
  }
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = cols.findIndex((c) => c === n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const iRadio = idx(["radio"]);
  const iMcc = idx(["mcc"]);
  const iMnc = idx(["net", "mnc"]);
  const iLac = idx(["area", "lac", "tac"]);
  const iCell = idx(["cell", "cellid"]);
  const iLon = idx(["lon", "lng"]);
  const iLat = idx(["lat"]);
  const iRange = idx(["range"]);
  const iSamples = idx(["samples"]);
  const iUpd = idx(["updated"]);
  const iSig = idx(["averagesignal", "averagesignalstrength"]);

  const cells: RawCell[] = [];
  for (let k = start; k < lines.length; k++) {
    const line = lines[k];
    if (!line) continue;
    const p = line.split(",");
    const mcc = Number(p[iMcc]);
    if (mcc !== YEMEN_MCC) continue;
    cells.push({
      radio: p[iRadio] ?? "",
      mcc,
      mnc: Number(p[iMnc]),
      lac: Number(p[iLac]),
      cellid: Number(p[iCell]),
      lat: Number(p[iLat]),
      lon: Number(p[iLon]),
      range: iRange >= 0 ? Number(p[iRange]) : undefined,
      samples: iSamples >= 0 ? Number(p[iSamples]) : undefined,
      updated: iUpd >= 0 ? Number(p[iUpd]) : undefined,
      averageSignal: iSig >= 0 ? Number(p[iSig]) : undefined,
    });
  }
  if (cells.length === 0) throw new Error("لم يتم العثور على أي خلايا يمنية (MCC=421) في الملف.");
  return groupCellsIntoTowers(cells, "csv");
}
