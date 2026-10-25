import { OPERATORS, TECHS, TECH_INFO, type OperatorId, type Tech } from "../data/operators";
import { clamp, haversine, type LatLon } from "./geo";
import type { Tower } from "./towers";

export interface TechCoverage {
  percent: number;
  dbm: number | null;
  towers: number;
  nearest: number | null;
  nearestTower: { tower: Tower; distance: number } | null;
}

export interface OperatorCoverage {
  operatorId: OperatorId;
  techs: Record<Tech, TechCoverage>;
  nearestTower: { tower: Tower; distance: number } | null;
  bestTech: Tech | null;
  overall: number;
}

export function effectiveRange(tower: Tower, tech: Tech): number {
  const base = TECH_INFO[tech].range;
  const r = tower.ranges[tech];
  return r ? clamp(r, base * 0.4, base * 1.6) : base;
}

/** قوة الإشارة (0..1) من برج على مسافة d بالمتر */
export function towerStrength(distance: number, range: number): number {
  return Math.exp(-2.3 * (distance / range) ** 2);
}

export function computeCoverage(point: LatLon, towers: Tower[]): OperatorCoverage[] {
  return OPERATORS.map((op) => {
    const opTowers = towers.filter((t) => t.operatorId === op.id);
    let nearestTower: OperatorCoverage["nearestTower"] = null;
    const distances = opTowers.map((t) => {
      const d = haversine(point, [t.lat, t.lon]);
      if (!nearestTower || d < nearestTower.distance) nearestTower = { tower: t, distance: d };
      return d;
    });

    const techs = {} as Record<Tech, TechCoverage>;
    for (const tech of TECHS) {
      let s1 = 0;
      let s2 = 0;
      let count = 0;
      let nearest: number | null = null;
      let nearestTowerForTech: TechCoverage["nearestTower"] = null;
      opTowers.forEach((t, i) => {
        if (!t.techs.includes(tech)) return;
        const d = distances[i];
        if (!nearestTowerForTech || d < nearestTowerForTech.distance) {
          nearestTowerForTech = { tower: t, distance: d };
        }
        const s = towerStrength(d, effectiveRange(t, tech));
        if (s > 0.02) count++;
        if (s > s1) {
          s2 = s1;
          s1 = s;
        } else if (s > s2) s2 = s;
        if (nearest === null || d < nearest) nearest = d;
      });
      // أقوى برج + مساهمة جزئية من البرج الثاني
      const combined = Math.min(0.99, s1 + (1 - s1) * s2 * 0.3);
      const percent = Math.round(clamp(combined, 0, 1) * 100);
      const info = TECH_INFO[tech];
      techs[tech] = {
        percent,
        dbm: percent > 0 ? Math.round(info.minDbm + (info.maxDbm - info.minDbm) * combined) : null,
        towers: count,
        nearest,
        nearestTower: nearestTowerForTech,
      };
    }

    const bestTech = TECHS.find((t) => techs[t].percent >= 25) ?? null;
    const overall = Math.max(...TECHS.map((t) => techs[t].percent));
    return { operatorId: op.id, techs, nearestTower, bestTech, overall };
  });
}

export function qualityLabel(percent: number): { label: string; color: string } {
  if (percent >= 75) return { label: "ممتازة", color: "#16a34a" };
  if (percent >= 50) return { label: "جيدة", color: "#65a30d" };
  if (percent >= 25) return { label: "متوسطة", color: "#d97706" };
  if (percent > 0) return { label: "ضعيفة", color: "#dc2626" };
  return { label: "لا توجد", color: "#94a3b8" };
}
