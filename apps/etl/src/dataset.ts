/**
 * Сборщик статического data-контракта (docs/05 §1): единый для демо- и
 * реального режимов. Источники подключаются провайдерами:
 *  - GeometryProvider: зоны контроля/фронт (DeepState или кейфрейм-приближение)
 *  - LossesProvider: потери (Генштаб ВСУ или синтетика)
 *  - EventsProvider: события (реальные ключевые или ключевые+синтетика)
 */
import * as fs from "node:fs";
import * as path from "node:path";
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
  dateToMs,
  eachDay,
  warDayNumber,
  type ChartFile,
  type DayBundle,
  type EquipmentRecord,
  type Manifest,
  type PersonnelEstimate,
  type WarEvent,
} from "@uwt/shared";
import { CITIES, KEY_EVENTS } from "./events";
import { REGIONS, type Region } from "./regions";

export interface DayGeometry {
  fronts: Map<string, LngLat[]>;
  polygons: Map<string, Feature<Polygon>>;
  areaSqkm: number;
  frontLenKm: number;
}

export interface GeometryProvider {
  sourceCode: string;
  computeDay(date: string): DayGeometry;
}

export interface LossesProvider {
  personnelAt(date: string): PersonnelEstimate[];
  equipmentAt(date: string): EquipmentRecord[];
  personnelSeries(dates: string[]): ChartFile["series"];
  equipmentSeries(dates: string[]): ChartFile["series"];
}

export interface EventsProvider {
  forDay(date: string, frontLine: LngLat[], frontChanged: boolean): WarEvent[];
}

export interface BuildOptions {
  outDir: string;
  firstDate: string;
  lastDate: string;
  demo: boolean;
  coverage: NonNullable<Manifest["coverage"]>;
  geometry: GeometryProvider;
  losses: LossesProvider;
  events: EventsProvider;
}

const MIN_DIFF_SQKM = 0.2;

/* ---------- Кейфрейм-геометрия (демо и офлайн-fallback) ---------- */

const RESAMPLE_N: Record<string, number> = { south: 240, north: 120 };

function isActive(region: Region, date: string): boolean {
  const t = dateToMs(date);
  if (t < dateToMs(region.activeFrom)) return false;
  if (region.activeTo && t > dateToMs(region.activeTo)) return false;
  return true;
}

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

function buildRing(region: Region, front: LngLat[]): LngLat[] {
  const iStart = nearestVertexIndex(region.border, front[0]!);
  const iEnd = nearestVertexIndex(region.border, front[front.length - 1]!);
  const lo = Math.min(iStart, iEnd);
  const hi = Math.max(iStart, iEnd);
  let back = region.border.slice(lo, hi + 1);
  if (iEnd > iStart) back = back.reverse();
  const ring = [...front, ...back];
  ring.push(ring[0]!);
  return ring;
}

/** Геометрия из кейфреймов regions.ts (docs/06 §7). */
export function approxGeometryProvider(sourceCode: string): GeometryProvider {
  return {
    sourceCode,
    computeDay(date: string): DayGeometry {
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
    },
  };
}

/* ---------- Дифы, GeoJSON, запись ---------- */

type DiffFeature = Feature<Polygon, { date: string; kind: string; areaSqkm: number }>;

function dayDiff(date: string, prev: DayGeometry | null, cur: DayGeometry): DiffFeature[] {
  if (!prev) return [];
  const out: DiffFeature[] = [];
  const ids = new Set([...cur.polygons.keys(), ...prev.polygons.keys()]);
  for (const id of ids) {
    const a = prev.polygons.get(id) ?? null;
    const b = cur.polygons.get(id) ?? null;
    // для зон ВСУ на территории РФ (ua:) семантика обратная:
    // рост зоны = занято ВСУ (синяя пульсация), сжатие = возвращено РФ
    const isUaZone = id.startsWith("ua:");
    const growKind = isUaZone ? "gained_ua" : "gained_ru";
    const shrinkKind = isUaZone ? "gained_ru" : "gained_ua";
    const push = (f: Feature<Polygon | MultiPolygon> | null, kind: string) => {
      if (!f) return;
      for (const piece of turf.flatten(f).features) {
        const sqkm = turf.area(piece) / 1e6;
        if (sqkm < MIN_DIFF_SQKM) continue;
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
        push(turf.difference(turf.featureCollection([b, a])), growKind);
        push(turf.difference(turf.featureCollection([a, b])), shrinkKind);
      } else if (a && !b) {
        push(a, shrinkKind);
      } else if (!a && b) {
        push(b, growKind);
      }
    } catch {
      /* вырожденная геометрия — день без диф-слоя */
    }
  }
  return out;
}

function fc(features: unknown[]): string {
  return JSON.stringify({ type: "FeatureCollection", features });
}

function controlGeojson(
  g: DayGeometry,
  date: string,
  lod: 0 | 1,
  sourceCode: string,
): string {
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
        side: (poly.properties as { side?: string } | null)?.side ?? "ru",
        date,
        segmentId: id,
        areaSqkm: Math.round((turf.area(poly) / 1e6) * 10) / 10,
        sourceCode,
        lod,
      },
    };
  });
  return fc(features);
}

function frontlineGeojson(
  g: DayGeometry,
  date: string,
  lod: 0 | 1,
  sourceCode: string,
): string {
  const features = [...g.fronts.entries()].map(([id, line]) => {
    const coords = lod === 0 ? simplifyLine(line, 0.03) : line;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: roundCoords(coords) },
      properties: {
        date,
        segmentId: id,
        lengthKm: Math.round(lineLengthKm(line) * 10) / 10,
        sourceCode,
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

/* ---------- Основной цикл сборки ---------- */

export function buildDataset(o: BuildOptions): void {
  const t0 = Date.now();
  const writeJson = (rel: string, data: unknown): void => {
    const file = path.join(o.outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
  };

  fs.rmSync(o.outDir, { recursive: true, force: true });
  fs.mkdirSync(o.outDir, { recursive: true });

  const areaSeries: Array<[string, number]> = [];
  const frontLenSeries: Array<[string, number]> = [];
  const weeklyEvents = new Map<string, Record<string, number>>();
  const manifestDays: Manifest["days"] = {};

  let prevGeo: DayGeometry | null = null;
  let prevArea = 0;
  let dayCount = 0;

  for (const date of eachDay(o.firstDate, o.lastDate)) {
    const geo = o.geometry.computeDay(date);
    const diffs = dayDiff(date, prevGeo, geo);
    const gainedRu = diffs
      .filter((d) => d.properties.kind === "gained_ru")
      .reduce((s, d) => s + d.properties.areaSqkm, 0);
    const gainedUa = diffs
      .filter((d) => d.properties.kind === "gained_ua")
      .reduce((s, d) => s + d.properties.areaSqkm, 0);

    const allFront = [...geo.fronts.values()].flat();
    const events = o.events.forDay(date, allFront, diffs.length > 0);

    const eventsByType: Record<string, number> = {};
    for (const e of events) eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;

    const weekStartMs =
      dateToMs(o.firstDate) +
      Math.floor((dateToMs(date) - dateToMs(o.firstDate)) / (7 * 86400000)) * 7 * 86400000;
    const weekKey = new Date(weekStartMs).toISOString().slice(0, 10);
    const bucket = weeklyEvents.get(weekKey) ?? {};
    for (const [k, v] of Object.entries(eventsByType)) bucket[k] = (bucket[k] ?? 0) + v;
    weeklyEvents.set(weekKey, bucket);

    const isLast = date === o.lastDate;
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
      losses: {
        personnel: o.losses.personnelAt(date),
        equipment: o.losses.equipmentAt(date),
      },
      diffSummary: {
        gainedRuSqkm: Math.round(gainedRu * 10) / 10,
        gainedUaSqkm: Math.round(gainedUa * 10) / 10,
      },
    };

    const dir = `days/${date}`;
    writeJson(`${dir}/bundle.json`, bundle);
    writeJson(`${dir}/control.z0.geojson`, controlGeojson(geo, date, 0, o.geometry.sourceCode));
    writeJson(`${dir}/control.z1.geojson`, controlGeojson(geo, date, 1, o.geometry.sourceCode));
    writeJson(`${dir}/frontline.geojson`, frontlineGeojson(geo, date, 1, o.geometry.sourceCode));
    writeJson(`${dir}/frontline.z0.geojson`, frontlineGeojson(geo, date, 0, o.geometry.sourceCode));
    writeJson(
      `${dir}/diff.geojson`,
      fc(
        diffs.map((d) => ({
          ...d,
          geometry: {
            ...d.geometry,
            coordinates: roundCoords(d.geometry.coordinates as LngLat[][]),
          },
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

  writeJson("series/control-area.json", {
    name: "control-area",
    unit: "км²",
    series: [
      {
        id: "ru-controlled",
        label: "Территория под контролем РФ (включая оккупированную с 2014)",
        sourceCode: o.geometry.sourceCode,
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
        sourceCode: o.geometry.sourceCode,
        side: null,
        points: frontLenSeries,
      },
    ],
  } satisfies ChartFile);

  const months = monthStarts(o.firstDate, o.lastDate);
  writeJson("series/losses-personnel.json", {
    name: "losses-personnel",
    unit: "человек",
    series: o.losses.personnelSeries(months),
  } satisfies ChartFile);
  writeJson("series/losses-equipment.json", {
    name: "losses-equipment",
    unit: "единиц",
    series: o.losses.equipmentSeries(months),
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
    demo: o.demo,
    coverage: o.coverage,
    firstDate: o.firstDate,
    lastDate: o.lastDate,
    days: manifestDays,
  };
  writeJson("manifest.json", manifest);

  console.log(
    `Готово: ${dayCount} дней → ${o.outDir} за ${((Date.now() - t0) / 1000).toFixed(1)} c`,
  );
}
