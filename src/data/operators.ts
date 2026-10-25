export type Tech = "2G" | "3G" | "4G" | "5G";
export type OperatorId = "yemenmobile" | "you" | "sabafon" | "y";

export const TECHS: Tech[] = ["5G", "4G", "3G", "2G"];

export interface TechInfo {
  label: string;
  /** نصف قطر التغطية الافتراضي بالمتر (حيث تنخفض الإشارة إلى ~10%) */
  range: number;
  color: string;
  minDbm: number;
  maxDbm: number;
  desc: string;
}

export const TECH_INFO: Record<Tech, TechInfo> = {
  "5G": { label: "5G", range: 650, color: "#a855f7", minDbm: -125, maxDbm: -70, desc: "NR الجيل الخامس" },
  "4G": { label: "4G", range: 2300, color: "#22c55e", minDbm: -125, maxDbm: -75, desc: "LTE الجيل الرابع" },
  "3G": { label: "3G", range: 3500, color: "#3b82f6", minDbm: -115, maxDbm: -65, desc: "UMTS / EV-DO الجيل الثالث" },
  "2G": { label: "2G", range: 5200, color: "#f97316", minDbm: -110, maxDbm: -60, desc: "GSM / CDMA الجيل الثاني" },
};

export interface Operator {
  id: OperatorId;
  name: string;
  nameEn: string;
  /** رمز الشبكة MNC ضمن رمز الدولة اليمن MCC=421 */
  mnc: number[];
  color: string;
  /** احتمال وجود برج في كل خلية شبكية (للبيانات التقديرية) */
  density: number;
  techProb: Record<Tech, number>;
}

export const YEMEN_MCC = 421;

export const OPERATORS: Operator[] = [
  {
    id: "yemenmobile",
    name: "يمن موبايل",
    nameEn: "Yemen Mobile",
    mnc: [3],
    color: "#e11d48",
    density: 0.55,
    techProb: { "2G": 0.55, "3G": 0.9, "4G": 0.62, "5G": 0.04 },
  },
  {
    id: "you",
    name: "يو",
    nameEn: "YOU",
    mnc: [2],
    color: "#eab308",
    density: 0.5,
    techProb: { "2G": 0.95, "3G": 0.75, "4G": 0.45, "5G": 0.02 },
  },
  {
    id: "sabafon",
    name: "سبأفون",
    nameEn: "SabaFon",
    mnc: [1],
    color: "#0ea5e9",
    density: 0.42,
    techProb: { "2G": 0.95, "3G": 0.7, "4G": 0.3, "5G": 0.01 },
  },
  {
    id: "y",
    name: "واي",
    nameEn: "Y Telecom",
    mnc: [4],
    color: "#8b5cf6",
    density: 0.3,
    techProb: { "2G": 0.9, "3G": 0.6, "4G": 0.22, "5G": 0 },
  },
];

export const OPERATOR_BY_ID: Record<OperatorId, Operator> = Object.fromEntries(
  OPERATORS.map((o) => [o.id, o])
) as Record<OperatorId, Operator>;

export function operatorFromMnc(mnc: number): Operator | undefined {
  return OPERATORS.find((o) => o.mnc.includes(mnc));
}

export function radioToTech(radio: string): Tech | undefined {
  const r = radio.trim().toUpperCase();
  if (r === "GSM") return "2G";
  if (r === "UMTS" || r === "CDMA") return "3G";
  if (r === "LTE") return "4G";
  if (r === "NR" || r === "5G") return "5G";
  return undefined;
}

/** تعز كموقع افتراضي (مركز المدينة) */
export const DEFAULT_CENTER: [number, number] = [13.5789, 44.0214];
export const DEFAULT_CITY = "تعز";
