/**
 * Генератор ДЕМО-датасета: материализует статический data-контракт
 * (docs/05 §1) в apps/web/public/data. В продакшене на этом месте —
 * publish-шаг ETL, читающий PostGIS (docs/03 §5); формат файлов идентичен.
 *
 * Запуск: pnpm gen:data  (≈15–60 c на полный диапазон дат)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import {
  lerpLine,
  lineLengthKm,
  nearestVertexIndex,
  resampleLine,
  roundCoords,
  simplifyLine,
  type LngLat,
} from "@uwt/geo";
import {
  FIRST_DATE,
  dateToMs,
  eachDay,
  sourceByCode,
  warDayNumber,
  type ChartFile,
  type DayBundle,
  type Manifest,
} from "@uwt/shared";
import { CITIES, KEY_EVENTS, generateEventsForDay } from "./events";
import { equipmentAt, personnelAt, PERSONNEL_SERIES, EQUIPMENT_SERIES } from "./losses";
import { REGIONS, type Region } from "./regions";

const LAST_DATE = process.env.UWT_LAST_DATE ?? "2025-12-31";
const OUT_DIR =
  process.env.UWT_DATA_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/public/data");

const RESAMPLE_N: Record<string, number> = { south: 240, north: 120 };
const MIN_DIFF_SQKM = 0.2;

interface DayGeometry {
  /** id региона -> интерполированная линия фронта */
  fronts: Map<string, LngLat[]>;
  /** id региона -> полигон зоны контроля */
  polygons: Map<string, Feature<Polygon>>;
  areaSqkm: number;
  frontLenKm: number;
}

function isActive(region: Region, date: string): boolean {
  const t = dateToMs(date);
  if (t < dateToMs(region.activeFrom)) return false;
  if (region.activeTo && t > dateToMs(region.activeTo)) return false;
  return true;
}

/** Интерполяция фронта региона на дату между кейфреймами. */
function frontAt(region: Region, date: string): LngLat[] {
  const n = RESAMPLE_N[region.id] ?? 200;
  const kfs = region.keyframes;
  const t = dateToMs(date);
  if (t <= dateToMs(kfs[0]!.date)) return resampleLine(kfs[0]!.front, n);
  const last = kfs[kfs.length - 1]!;
  if (t >= dateToMs(last.date)) return resampleLine(last.front, n);
  for (let i = 1; i < kfs.length; i++) {
    const t1 = dateToMs(kfs[i]!.date);
    if (t <= t1) {
      const t0 = dateToMs(kfs[i - 1]!.date);
      const f = (t - t0) / (t1 - t0);
      return lerpLine(
        resampleLine(kfs[i - 1]!.front, n),
        resampleLine(kfs[i]!.front, n),
        f,
      );
    }
  }
  return resampleLine(last.front, n);
}

/** Кольцо зоны контроля: фронт + участок периметра на оккупированной стороне (docs/06 §7). */
function buildRing(region: Region, front: LngLat[]): LngLat[] {
  const iStart = nearestVertexIndex(region.border, front[0]!);
  const iEnd = nearestVertexIndex(region.border, front[front.length - 1]!);
  const lo = Math.min(iStart, iEnd);
  const hi = Math.max(iStart, iEnd);
  let back = region.border.slice(lo, hi + 1);
  // замыкаем от конца фронта обратно к началу
  if (iEnd > iStart) back = back.reverse();
  const ring = [...front, ...back];
  ring.push(ring[0]!); // GeoJSON: первое = последнее
  return ring;
}

function computeDay(date: string): DayGeometry {
  const fronts = new Map<string, LngLat[]>();
  const polygons = new Map<string, Feature<Polygon>>();
  let area = 0;
  let frontLen = 0;
  for (const region of REGIONS) {
    if (!isActive(region, date)) continue;
    const front = frontAt(region, date);
    const ring = buildRing(region, front);
    const poly = turf.polygon([ring], { side: "ru", segmentId: region.id });
    fronts.set(region.id, front);
    polygons.set(region.id, poly);
    area += turf.area(poly) / 1e6;
    frontLen += lineLengthKm(front);
  }
  return { fronts, polygons, areaSqkm: area, frontLenKm: frontLen };
}

type DiffFeature = Feature<Polygon, { date: string; kind: string; areaSqkm: number }>;

/** Диф за день по региону: turf.difference с фильтром шума. */
function dayDiff(date: string, prev: DayGeometry | null, cur: DayGeometry): DiffFeature[] {
  if (!prev) return [];
  const out: DiffFeature[] = [];
  const ids = new Set([...cur.polygons.keys(), ...(prev ? prev.polygons.keys() : [])]);
  for (const id of ids) {
    const a = prev.polygons.get(id) ?? null; // вчера
    const b = cur.polygons.get(id) ?? null; // сегодня
    const push = (f: Feature<Polygon | MultiPolygon> | null, kind: string) => {
      if (!f) return;
      for (const piece of turf.flatten(f).features) {
        const sqkm = turf.area(piece) / 1e6;
        if (sqkm < MIN_DIFF_SQKM) continue; // фильтр «шума» ежедневных правок
        out.push(
          turf.polygon(piece.geometry.coordinates as LngLat[][], {
            date,
            kind,
            areaSqkm: Math.round(sqkm * 100) / 100,
          }) as DiffFeature,
        );
      }
    };
    try {
      if (a && b) {
        push(turf.difference(turf.featureCollection([b, a])), "gained_ru");
        push(turf.difference(turf.featureCollection([a, b])), "gained_ua");
      } else if (a && !b) {
        push(a, "gained_ua"); // регион исчез — освобождён целиком
      } else if (!a && b) {
        push(b, "gained_ru");
      }
    } catch {
      // редкие вырожденные геометрии интерполяции — день без диф-слоя
    }
  }
  return out;
}

function fc(features: unknown[]): string {
  return JSON.stringify({ type: "FeatureCollection", features });
}

function writeJson(rel: string, data: unknown): void {
  const file = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
}

function controlGeojson(g: DayGeometry, date: string, lod: 0 | 1): string {
  const features = [...g.polygons.entries()].map(([id, poly]) => {
    let ring = poly.geometry.coordinates[0] as LngLat[];
    if (lod === 0) {
      ring = simplifyLine(ring, 0.02);
      if (ring[0] !== ring[ring.length - 1]) ring = [...ring, ring[0]!];
    }
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [roundCoords(ring)] },
      properties: {
        side: "ru",
        date,
        segmentId: id,
        areaSqkm: Math.round((turf.area(poly) / 1e6) * 10) / 10,
        sourceCode: "deepstate",
        lod,
      },
    };
  });
  return fc(features);
}

function frontlineGeojson(g: DayGeometry, date: string, lod: 0 | 1): string {
  const features = [...g.fronts.entries()].map(([id, line]) => {
    const coords = lod === 0 ? simplifyLine(line, 0.03) : line;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: roundCoords(coords) },
      properties: {
        date,
        segmentId: id,
        lengthKm: Math.round(lineLengthKm(line) * 10) / 10,
        sourceCode: "deepstate",
        lod,
      },
    };
  });
  return fc(features);
}

function monthStarts(from: string, to: string): string[] {
  const out: string[] = [];
  for (const d of eachDay(from, to)) if (d.endsWith("-01")) out.push(d);
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

const METRIC_LABEL: Record<string, string> = {
  killed: "погибшие (оценка)",
  killed_confirmed_named: "погибшие (поимённо)",
  casualties_total: "потери суммарно (заявлено)",
};

const STATUS_LABEL: Record<string, string> = {
  destroyed: "уничтожено",
  captured: "захвачено",
  damaged: "повреждено",
  abandoned: "брошено",
  total_claimed: "заявлено",
};

const CATEGORY_LABEL: Record<string, string> = {
  tank: "танки",
  ifv: "БМП",
  apc: "БТР",
  artillery: "артиллерия",
  mlrs: "РСЗО",
  air_defense: "ПВО",
  aircraft: "самолёты",
  helicopter: "вертолёты",
  uav: "БПЛА",
  ship: "корабли",
  other: "прочее",
};

function main(): void {
  const t0 = Date.now();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const areaSeries: Array<[string, number]> = [];
  const frontLenSeries: Array<[string, number]> = [];
  const weeklyEvents = new Map<string, Record<string, number>>();
  const manifestDays: Manifest["days"] = {};

  let prevGeo: DayGeometry | null = null;
  let prevArea = 0;
  let dayCount = 0;

  for (const date of eachDay(FIRST_DATE, LAST_DATE)) {
    const geo = computeDay(date);
    const diffs = dayDiff(date, prevGeo, geo);
    const gainedRu = diffs
      .filter((d) => d.properties.kind === "gained_ru")
      .reduce((s, d) => s + d.properties.areaSqkm, 0);
    const gainedUa = diffs
      .filter((d) => d.properties.kind === "gained_ua")
      .reduce((s, d) => s + d.properties.areaSqkm, 0);

    const allFront = [...geo.fronts.values()].flat();
    const frontChanged = diffs.length > 0;
    const events = generateEventsForDay(date, allFront, frontChanged);

    const eventsByType: Record<string, number> = {};
    for (const e of events) eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;

    const weekStartMs =
      dateToMs(FIRST_DATE) +
      Math.floor((dateToMs(date) - dateToMs(FIRST_DATE)) / (7 * 86400000)) * 7 * 86400000;
    const weekKey = new Date(weekStartMs).toISOString().slice(0, 10);
    const bucket = weeklyEvents.get(weekKey) ?? {};
    for (const [k, v] of Object.entries(eventsByType)) bucket[k] = (bucket[k] ?? 0) + v;
    weeklyEvents.set(weekKey, bucket);

    const isLast = date === LAST_DATE;
    const bundle: DayBundle = {
      date,
      preliminary: isLast,
      stats: {
        date,
        dayNumber: warDayNumber(date),
        areaRuSqkm: Math.round(geo.areaSqkm),
        areaChangeSqkm: prevGeo ? Math.round((geo.areaSqkm - prevArea) * 10) / 10 : 0,
        frontlineLenKm: Math.round(geo.frontLenKm),
        eventsTotal: events.length,
        eventsByType,
        strikesMissile: eventsByType["missile_strike"] ?? 0,
        strikesUav: eventsByType["uav_strike"] ?? 0,
      },
      events,
      losses: { personnel: personnelAt(date), equipment: equipmentAt(date) },
      diffSummary: {
        gainedRuSqkm: Math.round(gainedRu * 10) / 10,
        gainedUaSqkm: Math.round(gainedUa * 10) / 10,
      },
    };

    const dir = `days/${date}`;
    writeJson(`${dir}/bundle.json`, bundle);
    writeJson(`${dir}/control.z0.geojson`, controlGeojson(geo, date, 0));
    writeJson(`${dir}/control.z1.geojson`, controlGeojson(geo, date, 1));
    writeJson(`${dir}/frontline.geojson`, frontlineGeojson(geo, date, 1));
    writeJson(`${dir}/frontline.z0.geojson`, frontlineGeojson(geo, date, 0));
    writeJson(
      `${dir}/diff.geojson`,
      fc(
        diffs.map((d) => ({
          ...d,
          geometry: { ...d.geometry, coordinates: roundCoords(d.geometry.coordinates as LngLat[][]) },
        })),
      ),
    );

    areaSeries.push([date, Math.round(geo.areaSqkm)]);
    frontLenSeries.push([date, Math.round(geo.frontLenKm)]);
    manifestDays[date] = { v: 1, preliminary: isLast };
    prevGeo = geo;
    prevArea = geo.areaSqkm;
    dayCount++;
    if (dayCount % 200 === 0) console.log(`  … ${date} (${dayCount} дней)`);
  }

  // ---- Ряды для графиков ----
  writeJson("series/control-area.json", {
    name: "control-area",
    unit: "км²",
    series: [
      {
        id: "ru-controlled",
        label: "Территория под контролем РФ (включая оккупированную с 2014)",
        sourceCode: "deepstate",
        side: "ru",
        points: areaSeries,
      },
    ],
  } satisfies ChartFile);

  writeJson("series/frontline-length.json", {
    name: "frontline-length",
    unit: "км",
    series: [
      {
        id: "frontline",
        label: "Длина линии фронта",
        sourceCode: "deepstate",
        side: null,
        points: frontLenSeries,
      },
    ],
  } satisfies ChartFile);

  const months = monthStarts(FIRST_DATE, LAST_DATE);
  writeJson("series/losses-personnel.json", {
    name: "losses-personnel",
    unit: "человек",
    series: PERSONNEL_SERIES.map((s) => ({
      id: `${s.side}:${s.sourceCode}:${s.metric}`,
      label: `${s.side === "ru" ? "РФ" : "Украина"} — ${METRIC_LABEL[s.metric]}`,
      sourceCode: s.sourceCode,
      side: s.side,
      points: months.map((m) => {
        const est = personnelAt(m).find(
          (p) => p.side === s.side && p.sourceCode === s.sourceCode && p.metric === s.metric,
        )!;
        return est.valueMin === est.valueMax
          ? [m, est.valueMin]
          : [m, est.valueMin, est.valueMax];
      }),
    })),
  } satisfies ChartFile);

  writeJson("series/losses-equipment.json", {
    name: "losses-equipment",
    unit: "единиц",
    series: EQUIPMENT_SERIES.map((s) => ({
      id: `${s.side}:${s.sourceCode}:${s.category}:${s.status}`,
      label: `${sourceByCode.get(s.sourceCode)!.name}: ${CATEGORY_LABEL[s.category] ?? s.category}, ${STATUS_LABEL[s.status] ?? s.status}`,
      sourceCode: s.sourceCode,
      side: s.side,
      points: months.map((m) => {
        const rec = equipmentAt(m).find(
          (r) =>
            r.side === s.side &&
            r.sourceCode === s.sourceCode &&
            r.category === s.category &&
            r.status === s.status,
        )!;
        return [m, rec.count];
      }),
    })),
  } satisfies ChartFile);

  writeJson("series/events-intensity.json", {
    name: "events-intensity",
    unit: "событий/нед.",
    series: (() => {
      const types = new Set<string>();
      for (const b of weeklyEvents.values()) for (const t of Object.keys(b)) types.add(t);
      return [...types].map((t) => ({
        id: `weekly:${t}`,
        label: t,
        sourceCode: null,
        side: null,
        points: [...weeklyEvents.entries()].map(([w, b]) => [w, b[t] ?? 0]),
      }));
    })(),
  } satisfies ChartFile);

  writeJson(
    "series/key-events.json",
    KEY_EVENTS.map((k) => ({ date: k.date, title: k.title })),
  );

  writeJson(
    "places.json",
    CITIES.map((c) => ({ name: c.name, kind: "city", coords: c.coords, zoom: 9 })),
  );

  const manifest: Manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    demo: true,
    firstDate: FIRST_DATE,
    lastDate: LAST_DATE,
    days: manifestDays,
  };
  writeJson("manifest.json", manifest);

  console.log(
    `Готово: ${dayCount} дней → ${OUT_DIR} за ${((Date.now() - t0) / 1000).toFixed(1)} c`,
  );
}

main();
