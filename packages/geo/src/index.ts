export type LngLat = [number, number];

const EARTH_R_KM = 6371;
const DEG = Math.PI / 180;

export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * DEG;
  const dLng = (b[0] - a[0]) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}

export function lineLengthKm(line: LngLat[]): number {
  let len = 0;
  for (let i = 1; i < line.length; i++) len += haversineKm(line[i - 1]!, line[i]!);
  return len;
}

/**
 * Ресемплинг полилинии до ровно n вершин по длине дуги.
 * База интерполяции линии фронта: обе даты приводятся к одному n,
 * после чего вершины лерпятся попарно (см. docs/06 §5).
 */
export function resampleLine(line: LngLat[], n: number): LngLat[] {
  if (line.length < 2 || n < 2) return line.slice();
  const cum: number[] = [0];
  for (let i = 1; i < line.length; i++) {
    cum.push(cum[i - 1]! + haversineKm(line[i - 1]!, line[i]!));
  }
  const total = cum[cum.length - 1]!;
  if (total === 0) return Array.from({ length: n }, () => [...line[0]!] as LngLat);
  const out: LngLat[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (seg < line.length - 2 && cum[seg + 1]! < target) seg++;
    const segLen = cum[seg + 1]! - cum[seg]!;
    const t = segLen === 0 ? 0 : (target - cum[seg]!) / segLen;
    const a = line[seg]!;
    const b = line[seg + 1]!;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Покомпонентный лерп двух линий одинаковой длины. */
export function lerpLine(a: LngLat[], b: LngLat[], t: number): LngLat[] {
  const n = Math.min(a.length, b.length);
  const out: LngLat[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = a[i]!;
    const q = b[i]!;
    out[i] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  }
  return out;
}

/** Douglas–Peucker (в градусах) — упрощение для LOD. */
export function simplifyLine(line: LngLat[], toleranceDeg: number): LngLat[] {
  if (line.length <= 2) return line.slice();
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const a = line[s]!;
    const b = line[e]!;
    for (let i = s + 1; i < e; i++) {
      const d = pointToSegmentDeg(line[i]!, a, b);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > toleranceDeg && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: LngLat[] = [];
  for (let i = 0; i < line.length; i++) if (keep[i]) out.push(line[i]!);
  return out;
}

function pointToSegmentDeg(p: LngLat, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Площадь кольца в км² (планарная шнуровка с поправкой на широту — достаточно для статистики). */
export function ringAreaSqkm(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const degKm = 111.32;
  let latSum = 0;
  for (const p of ring) latSum += p[1];
  const cosLat = Math.cos((latSum / ring.length) * DEG);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const ax = a[0] * cosLat * degKm;
    const ay = a[1] * degKm;
    const bx = b[0] * cosLat * degKm;
    const by = b[1] * degKm;
    sum += ax * by - bx * ay;
  }
  return Math.abs(sum / 2);
}

/** Округление координат (5 знаков ≈ 1 м) — экономит ~30% веса GeoJSON. */
export function roundCoords<T extends LngLat[] | LngLat[][]>(coords: T, digits = 5): T {
  const f = 10 ** digits;
  const rec = (c: unknown): unknown =>
    Array.isArray(c) && typeof c[0] === "number"
      ? (c as number[]).map((v) => Math.round(v * f) / f)
      : (c as unknown[]).map(rec);
  return rec(coords) as T;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Ближайший индекс вершины полилинии к точке (для автозамыкания колец в ETL). */
export function nearestVertexIndex(line: LngLat[], p: LngLat): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < line.length; i++) {
    const d = Math.hypot(line[i]![0] - p[0], line[i]![1] - p[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
