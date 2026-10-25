export type LatLon = [number, number];

export function haversine(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} م`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} كم`;
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
