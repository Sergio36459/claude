/**
 * Сборка собственной подложки карты из Natural Earth (public domain):
 * страны, области Украины, города, точки подписей стран + глифы шрифтов.
 * Результат коммитится в apps/web/public/{basemap,glyphs} — карта работает
 * без внешних тайл-серверов, «мировая карта» в границах региона.
 *
 * Запуск: pnpm --filter @uwt/etl gen:basemap
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { roundCoords, type LngLat } from "@uwt/geo";

/** Регион: Украина + Россия (европейская часть) + соседи. */
export const REGION_BBOX: [number, number, number, number] = [15, 38, 65, 62];

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const FONTS =
  "https://raw.githubusercontent.com/klokantech/klokantech-gl-fonts/master";

const WEB_PUBLIC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/public",
);

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return (await res.json()) as T;
}

function writeJson(rel: string, data: unknown): number {
  const file = path.join(WEB_PUBLIC, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify(data);
  fs.writeFileSync(file, body);
  return body.length;
}

function clipToRegion(
  fc: FeatureCollection,
  props: (f: Feature) => Record<string, unknown>,
): FeatureCollection {
  const out: Feature[] = [];
  for (const f of fc.features) {
    if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
    try {
      const clipped = turf.bboxClip(f as Feature<Polygon | MultiPolygon>, REGION_BBOX);
      // bboxClip оставляет пустые кольца/части — MapLibre отвергает такой источник целиком
      const validRing = (r: LngLat[]) => Array.isArray(r) && r.length >= 4;
      if (clipped.geometry.type === "Polygon") {
        clipped.geometry.coordinates = (
          clipped.geometry.coordinates as LngLat[][]
        ).filter(validRing);
        if (clipped.geometry.coordinates.length === 0) continue;
      } else {
        clipped.geometry.coordinates = (clipped.geometry.coordinates as LngLat[][][])
          .map((poly) => poly.filter(validRing))
          .filter((poly) => poly.length > 0);
        if (clipped.geometry.coordinates.length === 0) continue;
      }
      const area = turf.area(clipped);
      if (area < 1e7) continue; // <10 км² после обрезки — отбрасываем
      clipped.properties = props(f);
      clipped.geometry.coordinates = roundCoords(
        clipped.geometry.coordinates as LngLat[][] | LngLat[][][] as never,
        3,
      ) as never;
      out.push(clipped);
    } catch {
      /* редкие невалидные геометрии NE пропускаем */
    }
  }
  return { type: "FeatureCollection", features: out };
}

async function buildCountries(): Promise<void> {
  const raw = await fetchJson<FeatureCollection>(`${NE}/ne_50m_admin_0_countries.geojson`);
  const p = (f: Feature) => {
    const pr = f.properties as Record<string, unknown>;
    return {
      name: (pr.NAME_RU as string) || (pr.NAME as string),
      iso: pr.ISO_A3 as string,
      ua: pr.ISO_A3 === "UKR" ? 1 : 0,
    };
  };
  const fc = clipToRegion(raw, p);
  const size = writeJson("basemap/countries.geojson", fc);
  console.log(`countries: ${fc.features.length} стран, ${(size / 1024).toFixed(0)} КБ`);

  // точки подписей: центр масс крупнейшей части внутри региона
  const labels: Feature[] = [];
  for (const f of fc.features) {
    const parts = turf.flatten(f as Feature<Polygon | MultiPolygon>).features;
    let best: Feature<Polygon> | null = null;
    let bestArea = 0;
    for (const part of parts) {
      const a = turf.area(part);
      if (a > bestArea) {
        bestArea = a;
        best = part as Feature<Polygon>;
      }
    }
    if (!best || bestArea < 5e9) continue; // подписываем страны крупнее ~5000 км²
    const pt = turf.centerOfMass(best);
    pt.properties = { name: (f.properties as { name: string }).name, area: bestArea };
    pt.geometry.coordinates = pt.geometry.coordinates.map((c) => Math.round(c * 100) / 100);
    labels.push(pt);
  }
  const lsize = writeJson("basemap/country-labels.geojson", {
    type: "FeatureCollection",
    features: labels,
  });
  console.log(`country-labels: ${labels.length} подписей, ${(lsize / 1024).toFixed(0)} КБ`);
}

async function buildAdmin1Ukraine(): Promise<void> {
  // области всех стран есть только в 10m-наборе (50m — выборка крупных стран)
  const raw = await fetchJson<FeatureCollection>(
    `${NE}/ne_10m_admin_1_states_provinces.geojson`,
  );
  const ua: FeatureCollection = {
    type: "FeatureCollection",
    features: raw.features.filter(
      (f) => (f.properties as Record<string, unknown>).iso_a2 === "UA",
    ),
  };
  const fc = clipToRegion(ua, (f) => ({
    name:
      ((f.properties as Record<string, unknown>).name_ru as string) ||
      ((f.properties as Record<string, unknown>).name as string),
  }));
  const size = writeJson("basemap/admin1-ua.geojson", fc);
  console.log(`admin1-ua: ${fc.features.length} областей, ${(size / 1024).toFixed(0)} КБ`);
}

async function buildPlaces(): Promise<void> {
  const raw = await fetchJson<FeatureCollection>(`${NE}/ne_50m_populated_places.geojson`);
  const [w, s, e, n] = REGION_BBOX;
  const features: Feature[] = [];
  for (const f of raw.features) {
    if (f.geometry.type !== "Point") continue;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    if (lng < w || lng > e || lat < s || lat > n) continue;
    const pr = f.properties as Record<string, unknown>;
    const pop = (pr.POP_MAX as number) ?? 0;
    const cap = pr.ADM0CAP === 1 || pr.ADM0CAP === 1.0;
    if (!cap && pop < 150_000) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000],
      },
      properties: {
        name: (pr.NAME_RU as string) || (pr.NAME as string),
        pop,
        cap: cap ? 1 : 0,
        // ранг для зум-зависимого показа подписей
        rank: cap ? 0 : pop > 1_000_000 ? 1 : pop > 500_000 ? 2 : 3,
      },
    });
  }
  const size = writeJson("basemap/places.geojson", {
    type: "FeatureCollection",
    features,
  });
  console.log(`places: ${features.length} городов, ${(size / 1024).toFixed(0)} КБ`);
}

async function buildGlyphs(): Promise<void> {
  // Диапазоны: латиница, расширенная латиница, кириллица
  const ranges = ["0-255", "256-511", "1024-1279"];
  const fonts = ["KlokanTech Noto Sans Regular", "KlokanTech Noto Sans Bold"];
  for (const font of fonts) {
    for (const range of ranges) {
      const url = `${FONTS}/${encodeURIComponent(font)}/${range}.pbf`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(WEB_PUBLIC, "glyphs", font, `${range}.pbf`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      console.log(`glyphs: ${font}/${range}.pbf ${(buf.length / 1024).toFixed(0)} КБ`);
    }
  }
}

async function main(): Promise<void> {
  await buildCountries();
  await buildAdmin1Ukraine();
  await buildPlaces();
  await buildGlyphs();
  console.log("Подложка собрана → apps/web/public/{basemap,glyphs}");
}

void main();
