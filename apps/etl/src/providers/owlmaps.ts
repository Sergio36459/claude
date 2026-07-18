/**
 * РЕАЛЬНАЯ геометрия зон контроля: UA Control Map (Project Owl,
 * uacontrolmap.com). Ежедневные KMZ-архивы карты публикуются в
 * github.com/owlmaps/UAControlMapBackups (год/файл.kmz + ветка latest).
 *
 * Семантика слоёв KML:
 *  - папка «Important Areas»: полигоны зон — контроль РФ = все, КРОМЕ
 *    «Ukrainian *» (контрнаступления/присутствие ВСУ) и «Transnistria»;
 *  - папка «Frontline»: готовые LineString линии фронта.
 *
 * KMZ ~3–4 МБ/день, поэтому история сэмплируется (по умолчанию раз в
 * UWT_OWLMAPS_STEP_DAYS=7 дней) — реальные кейфреймы, между которыми
 * геометрия интерполируется по совпадающим именам полигонов (стабильны
 * между днями). Файлы кэшируются на диск: повторные сборки офлайн.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { unzipSync } from "fflate";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { lerpLine, lineLengthKm, resampleLine, type LngLat } from "@uwt/geo";
import { addDays, dateToMs } from "@uwt/shared";
import type { DayGeometry, GeometryProvider } from "../dataset";

const REPO = "owlmaps/UAControlMapBackups";
const API = process.env.UWT_GH_API ?? "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const STEP_DAYS = Math.max(1, Number(process.env.UWT_OWLMAPS_STEP_DAYS ?? 7));
const RING_N = 300;
const LINE_N = 400;

/* ---------------- KML-парсинг (без внешних XML-зависимостей) ---------------- */

/** Содержимое <Folder> с данным именем, с учётом вложенных папок. */
function extractFolder(kml: string, name: string): string | null {
  const re = new RegExp(`<Folder>\\s*<name>${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</name>`);
  const m = re.exec(kml);
  if (!m) return null;
  let depth = 0;
  let i = m.index;
  while (i < kml.length) {
    const open = kml.indexOf("<Folder>", i + 1);
    const close = kml.indexOf("</Folder>", i + 1);
    if (close < 0) break;
    if (open >= 0 && open < close) {
      depth++;
      i = open;
    } else {
      if (depth === 0) return kml.slice(m.index, close);
      depth--;
      i = close;
    }
  }
  return null;
}

function parseCoords(block: string): LngLat[] {
  const m = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  if (!m) return [];
  const out: LngLat[] = [];
  for (const token of m[1]!.trim().split(/\s+/)) {
    const [lng, lat] = token.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng!, lat!]);
  }
  return out;
}

/** Граница Украины из собранной подложки — для отсечения справочных слоёв внутри страны. */
let ukraineBoundary: Feature<Polygon | import("geojson").MultiPolygon> | null | undefined;

function loadUkraineBoundary(): typeof ukraineBoundary {
  if (ukraineBoundary !== undefined) return ukraineBoundary;
  try {
    const file = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../../../web/public/basemap/countries.geojson",
    );
    const fc = JSON.parse(fs.readFileSync(file, "utf8")) as {
      features: Array<Feature<Polygon | import("geojson").MultiPolygon>>;
    };
    ukraineBoundary =
      fc.features.find((f) => (f.properties as { ua?: number } | null)?.ua === 1) ?? null;
  } catch {
    ukraineBoundary = null;
  }
  if (!ukraineBoundary) {
    console.warn(
      "owlmaps: граница Украины не найдена (pnpm gen:basemap) — зоны ВСУ на терр. РФ отключены.",
    );
  }
  return ukraineBoundary;
}

/** Центр кольца вне границ Украины (зона Курской операции — в РФ). */
function isOutsideUkraine(ring: LngLat[]): boolean {
  const ua = loadUkraineBoundary();
  if (!ua) return false; // консервативно: без границы не классифицируем
  try {
    const centroid = turf.centerOfMass(turf.polygon([[...ring, ring[0]!]]));
    return !turf.booleanPointInPolygon(centroid, ua);
  } catch {
    return false;
  }
}

interface ParsedDay {
  /**
   * имя полигона → внешние кольца (для интерполяции по имени).
   * Ключи с префиксом "ua:" — зоны под контролем ВСУ на территории РФ
   * (Курская операция 2024–2025 и т.п.), рендерятся синим.
   */
  zones: Map<string, LngLat[][]>;
  /** имя линии → координаты */
  lines: Map<string, LngLat[]>;
}

/** Полигоны контроля РФ + линии фронта из KMZ. */
export function parseControlKmz(kmz: Uint8Array): ParsedDay {
  const files = unzipSync(kmz);
  const kmlEntry = Object.keys(files).find((f) => f.toLowerCase().endsWith(".kml"));
  if (!kmlEntry) throw new Error("KMZ без KML внутри");
  const kml = Buffer.from(files[kmlEntry]!).toString("utf8");

  const zones = new Map<string, LngLat[][]>();
  const areas = extractFolder(kml, "Important Areas");
  if (areas) {
    let anon = 0;
    for (const pm of areas.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
      const body = pm[1]!;
      const name =
        (body.match(/<name>([^<]+)<\/name>/) ?? [])[1]?.trim() || `zone-${anon++}`;
      // Семантика цвета стилей Project Owl: красные (R > B, напр. A52714,
      // 880E4F) — зоны контроля РФ; синие (01579B) — украинские слои и
      // архивные полигоны. Это корректно и в исторических файлах.
      const styleHex = (body.match(/<styleUrl>#?poly-([0-9A-Fa-f]{6})/) ?? [])[1];
      if (!styleHex) continue;
      const r = parseInt(styleHex.slice(0, 2), 16);
      const b = parseInt(styleHex.slice(4, 6), 16);
      const isRed = r > b; // контроль РФ
      // синие «*Incursion*/*Kursk*» — кандидаты в зоны контроля ВСУ на
      // территории РФ (Курская операция); «Presence»/«Counterattack» —
      // справочные слои ВНУТРИ Украины, их не берём. Ниже дополнительная
      // проверка: центр зоны должен лежать вне границ Украины.
      const isUaCandidate = !isRed && /(incursion|kursk)/i.test(name);
      if (!isRed && !isUaCandidate) continue;
      if (isRed && (/^ukrainian/i.test(name) || /transnistria/i.test(name))) continue;
      const rings: LngLat[][] = [];
      for (const poly of body.matchAll(/<Polygon>([\s\S]*?)<\/Polygon>/g)) {
        const outer = poly[1]!.match(/<outerBoundaryIs>([\s\S]*?)<\/outerBoundaryIs>/);
        const ring = parseCoords(outer ? outer[1]! : poly[1]!);
        if (ring.length >= 4) rings.push(ring);
      }
      if (rings.length === 0) continue;
      if (isUaCandidate && !isOutsideUkraine(rings[0]!)) continue;
      zones.set(isUaCandidate ? `ua:${name}` : name, rings);
    }
  }

  const lines = new Map<string, LngLat[]>();
  const front = extractFolder(kml, "Frontline");
  if (front) {
    for (const pm of front.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
      const body = pm[1]!;
      const name = (body.match(/<name>([^<]+)<\/name>/) ?? [])[1]?.trim() ?? "";
      const ls = body.match(/<LineString>([\s\S]*?)<\/LineString>/);
      if (!name || !ls) continue;
      const coords = parseCoords(ls[1]!);
      if (coords.length >= 2) lines.set(name, coords);
    }
  }

  if (zones.size === 0) throw new Error("KMZ: слой Important Areas пуст/не найден");
  return { zones, lines };
}

/* ---------------- Список архива и загрузка ---------------- */

async function fetchOk(url: string, timeoutMs = 60_000): Promise<Response> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "uwt-etl (Ukraine War Timeline, open-source)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

interface ArchiveEntry {
  date: string;
  url: string;
}

/** Дата из имени файла: поддерживаются YYYY-MM-DD и YYYYMMDD в любом месте имени. */
function dateFromName(name: string): string | null {
  const iso = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = name.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}

async function listArchive(firstDate: string, lastYear: number): Promise<ArchiveEntry[]> {
  const byDate = new Map<string, ArchiveEntry>();
  const firstYear = Number(firstDate.slice(0, 4));
  for (let year = firstYear; year <= lastYear; year++) {
    // корень репозитория (старые файлы) проверяем только через годовые папки:
    // с мая 2026 архив разложен по папкам-годам
    try {
      const res = await fetchOk(`${API}/repos/${REPO}/contents/${year}`);
      const items = (await res.json()) as Array<{ name: string; download_url: string }>;
      for (const it of items) {
        if (!it.name.toLowerCase().endsWith(".kmz")) continue;
        const d = dateFromName(it.name);
        if (!d || dateToMs(d) < dateToMs(firstDate)) continue;
        byDate.set(d, { date: d, url: it.download_url }); // последний файл дня побеждает
      }
    } catch (e) {
      console.warn(`owlmaps: не удалось перечислить ${year}/ (${(e as Error).message})`);
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* ---------------- Провайдер ---------------- */

interface Keyframe {
  date: string;
  zones: Map<string, LngLat[][]>; // кольца, ресемплированные до RING_N
  lines: Map<string, LngLat[]>; // линии, ресемплированные до LINE_N
}

function toKeyframe(date: string, parsed: ParsedDay): Keyframe {
  const zones = new Map<string, LngLat[][]>();
  for (const [name, rings] of parsed.zones) {
    zones.set(
      name,
      rings.map((r) => resampleLine(r, RING_N)),
    );
  }
  const lines = new Map<string, LngLat[]>();
  for (const [name, coords] of parsed.lines) lines.set(name, resampleLine(coords, LINE_N));
  return { date, zones, lines };
}

function keyframeToGeometry(zones: Map<string, LngLat[][]>, lines: Map<string, LngLat[]>): DayGeometry {
  const fronts = new Map<string, LngLat[]>();
  const polygons = new Map<string, Feature<Polygon>>();
  let frontLen = 0;
  for (const [name, rings] of zones) {
    const side = name.startsWith("ua:") ? "ua" : "ru";
    rings.forEach((ring, i) => {
      const closed = ring[0] === ring[ring.length - 1] ? ring : [...ring, ring[0]!];
      try {
        const poly = turf.polygon([closed], { side, segmentId: `${name}#${i}` });
        if (turf.area(poly) / 1e6 < 1) return;
        polygons.set(`${name}#${i}`, poly as Feature<Polygon>);
      } catch {
        /* вырожденное кольцо */
      }
    });
  }
  // площадь контроля РФ — через union: зоны перекрываются («Advances»
  // поверх осей), простая сумма завысила бы контроль на ~20%.
  // Зоны ВСУ на территории РФ (ua:) в статистику площади не входят.
  const ruPolys = [...polygons.entries()]
    .filter(([id]) => !id.startsWith("ua:"))
    .map(([, p]) => p);
  let area = 0;
  try {
    const merged =
      ruPolys.length > 1 ? turf.union(turf.featureCollection(ruPolys)) : ruPolys[0];
    if (merged) area = turf.area(merged) / 1e6;
  } catch {
    for (const p of ruPolys) area += turf.area(p) / 1e6;
  }
  for (const [name, coords] of lines) {
    fronts.set(name, coords);
    frontLen += lineLengthKm(coords);
  }
  return { fronts, polygons, areaSqkm: area, frontLenKm: frontLen };
}

export async function tryLoadOwlmaps(
  firstDate: string,
  lastDate: string,
  cacheDir: string,
): Promise<(GeometryProvider & { lastDate: string }) | null> {
  fs.mkdirSync(cacheDir, { recursive: true });
  let entries: ArchiveEntry[];
  try {
    entries = await listArchive(firstDate, Number(lastDate.slice(0, 4)));
    if (entries.length === 0) throw new Error("архив пуст");
  } catch (e) {
    // офлайн: используем ранее скачанные KMZ из кэша (имена = даты)
    const cached: ArchiveEntry[] = fs
      .readdirSync(cacheDir)
      .filter((f) => f.endsWith(".kmz") && dateFromName(f))
      .map((f) => ({ date: dateFromName(f)!, url: `file://${path.join(cacheDir, f)}` }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (cached.length === 0) {
      console.warn(`UA Control Map недоступен (${(e as Error).message}).`);
      return null;
    }
    console.warn(
      `UA Control Map: сеть недоступна (${(e as Error).message}) — используем кэш: ${cached.length} файлов.`,
    );
    entries = cached;
  }

  // сэмплирование: каждый STEP_DAYS-й день + последний доступный
  const sampled: ArchiveEntry[] = [];
  let nextMs = dateToMs(entries[0]!.date);
  for (const e of entries) {
    if (dateToMs(e.date) >= nextMs) {
      sampled.push(e);
      nextMs = dateToMs(addDays(e.date, STEP_DAYS));
    }
  }
  const last = entries[entries.length - 1]!;
  if (sampled[sampled.length - 1]!.date !== last.date) sampled.push(last);
  console.log(
    `UA Control Map: ${entries.length} дней в архиве, скачиваем ${sampled.length} кейфреймов (шаг ${STEP_DAYS} дн.)`,
  );

  const keyframes: Keyframe[] = [];
  for (const e of sampled) {
    const cacheFile = path.join(cacheDir, `${e.date}.kmz`);
    try {
      let buf: Uint8Array;
      if (fs.existsSync(cacheFile)) {
        buf = fs.readFileSync(cacheFile);
      } else {
        const res = await fetchOk(e.url, 120_000);
        buf = new Uint8Array(await res.arrayBuffer());
        fs.writeFileSync(cacheFile, buf);
        await new Promise((r) => setTimeout(r, 200));
      }
      keyframes.push(toKeyframe(e.date, parseControlKmz(buf)));
      if (keyframes.length % 25 === 0) console.log(`  … кейфрейм ${e.date} (${keyframes.length})`);
    } catch (err) {
      console.warn(`owlmaps: пропуск ${e.date} (${(err as Error).message})`);
    }
  }
  if (keyframes.length < 1) {
    console.warn("owlmaps: нет ни одного кейфрейма.");
    return null;
  }
  if (keyframes.length === 1) {
    console.warn(
      "owlmaps: один кейфрейм — геометрия будет статичной (для истории нужен доступ к api.github.com).",
    );
  }

  const kfLast = keyframes[keyframes.length - 1]!;
  const cache = new Map<string, DayGeometry>();
  // мемоизация краёв: до первого/после последнего кейфрейма геометрия статична
  let gFirst: DayGeometry | null = null;
  let gLast: DayGeometry | null = null;

  const computeDay = (date: string): DayGeometry => {
    const hit = cache.get(date);
    if (hit) return hit;
    const t = dateToMs(date);
    let g: DayGeometry;
    if (t <= dateToMs(keyframes[0]!.date)) {
      g = gFirst ??= keyframeToGeometry(keyframes[0]!.zones, keyframes[0]!.lines);
    } else if (t >= dateToMs(kfLast.date)) {
      g = gLast ??= keyframeToGeometry(kfLast.zones, kfLast.lines);
    } else {
      let i = 1;
      while (i < keyframes.length && dateToMs(keyframes[i]!.date) < t) i++;
      const k0 = keyframes[i - 1]!;
      const k1 = keyframes[i]!;
      const f = (t - dateToMs(k0.date)) / (dateToMs(k1.date) - dateToMs(k0.date));
      // интерполяция по совпадающим именам; новые/исчезнувшие — от ближайшего кейфрейма
      const zones = new Map<string, LngLat[][]>();
      const names = new Set([...k0.zones.keys(), ...k1.zones.keys()]);
      for (const name of names) {
        const a = k0.zones.get(name);
        const b = k1.zones.get(name);
        if (a && b) {
          const n = Math.min(a.length, b.length);
          const rings: LngLat[][] = [];
          for (let r = 0; r < n; r++) rings.push(lerpLine(a[r]!, b[r]!, f));
          for (let r = n; r < (f < 0.5 ? a.length : b.length); r++) {
            rings.push((f < 0.5 ? a : b)[r]!);
          }
          zones.set(name, rings);
        } else {
          const src = f < 0.5 ? a : b;
          if (src) zones.set(name, src);
        }
      }
      const lines = new Map<string, LngLat[]>();
      const lineNames = new Set([...k0.lines.keys(), ...k1.lines.keys()]);
      for (const name of lineNames) {
        const a = k0.lines.get(name);
        const b = k1.lines.get(name);
        if (a && b) lines.set(name, lerpLine(a, b, f));
        else {
          const src = f < 0.5 ? a : b;
          if (src) lines.set(name, src);
        }
      }
      g = keyframeToGeometry(zones, lines);
    }
    // кэш последних дней (LRU не нужен: dataset идёт по датам последовательно)
    cache.set(date, g);
    if (cache.size > 3) cache.delete(cache.keys().next().value!);
    return g;
  };

  return { sourceCode: "owlmaps", lastDate: kfLast.date, computeDay };
}
