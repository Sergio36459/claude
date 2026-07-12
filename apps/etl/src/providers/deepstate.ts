/**
 * РЕАЛЬНАЯ геометрия зон контроля: DeepState (deepstatemap.live).
 * API: /api/history — список снапшотов; /api/history/{id}/geojson — геометрия.
 *
 * Из ограниченных сетевых окружений API недоступен — провайдер возвращает
 * null, и сборка честно откатывается на кейфрейм-приближение с пометкой
 * coverage.geometry = 'approximate'. При запуске с открытой сетью
 * подтягивается полная история. Сырые ответы кэшируются на диск
 * (raw-архив, docs/03 §5) — повторные сборки не бьют по API.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { lineLengthKm, resampleLine, type LngLat } from "@uwt/geo";
import { dateToMs, eachDay } from "@uwt/shared";
import type { DayGeometry, GeometryProvider } from "../dataset";

const API = process.env.UWT_DEEPSTATE_API ?? "https://deepstatemap.live/api";

interface HistoryItem {
  id: number;
  createdAt?: string;
  datetime?: string;
  date?: string;
}

function itemDate(it: HistoryItem): string | null {
  const raw = it.datetime ?? it.createdAt ?? it.date;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return (await res.json()) as T;
}

/** Полигоны оккупации из снапшота DeepState → DayGeometry проекта. */
function toDayGeometry(fcRaw: FeatureCollection): DayGeometry {
  const fronts = new Map<string, LngLat[]>();
  const polygons = new Map<string, Feature<Polygon>>();
  let area = 0;
  let frontLen = 0;
  let i = 0;
  for (const f of fcRaw.features) {
    if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
    for (const piece of turf.flatten(f as Feature<Polygon | MultiPolygon>).features) {
      const sqkm = turf.area(piece) / 1e6;
      if (sqkm < 5) continue; // мелкий мусор разметки
      const id = `ds-${i++}`;
      polygons.set(id, piece as Feature<Polygon>);
      const ring = piece.geometry.coordinates[0] as LngLat[];
      // фронт-сегмент для анимации: внешнее кольцо, приведённое к сетке
      fronts.set(id, resampleLine(ring, Math.min(300, Math.max(60, ring.length))));
      area += sqkm;
      frontLen += lineLengthKm(ring);
    }
  }
  return { fronts, polygons, areaSqkm: area, frontLenKm: frontLen };
}

export async function tryLoadDeepstate(
  firstDate: string,
  lastDate: string,
  cacheDir: string,
): Promise<(GeometryProvider & { lastDate: string }) | null> {
  let history: HistoryItem[];
  try {
    history = await fetchJson<HistoryItem[]>(`${API}/history`);
    if (!Array.isArray(history) || history.length === 0) throw new Error("empty history");
  } catch (e) {
    console.warn(
      `DeepState недоступен (${(e as Error).message}) — геометрия будет приближением.`,
    );
    return null;
  }

  // последний снапшот каждого дня
  const byDay = new Map<string, HistoryItem>();
  for (const it of history) {
    const d = itemDate(it);
    if (!d || dateToMs(d) < dateToMs(firstDate)) continue;
    const prev = byDay.get(d);
    if (!prev || it.id > prev.id) byDay.set(d, it);
  }
  const days = [...byDay.keys()].sort();
  const dsLast = days[days.length - 1]!;
  console.log(`DeepState: ${days.length} дней истории, по ${dsLast}`);

  fs.mkdirSync(cacheDir, { recursive: true });
  const cache = new Map<string, DayGeometry>();

  const loadDay = async (d: string): Promise<DayGeometry | null> => {
    const it = byDay.get(d);
    if (!it) return null;
    const cacheFile = path.join(cacheDir, `${d}.geojson`);
    let fcRaw: FeatureCollection;
    if (fs.existsSync(cacheFile)) {
      fcRaw = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as FeatureCollection;
    } else {
      fcRaw = await fetchJson<FeatureCollection>(`${API}/history/${it.id}/geojson`);
      fs.writeFileSync(cacheFile, JSON.stringify(fcRaw));
      await new Promise((r) => setTimeout(r, 150)); // щадящий ритм к API
    }
    return toDayGeometry(fcRaw);
  };

  // Предзагрузка всей истории последовательно (идемпотентно за счёт кэша)
  let lastKnown: DayGeometry | null = null;
  for (const d of eachDay(firstDate, dsLast)) {
    const g = await loadDay(d);
    if (g) lastKnown = g;
    if (lastKnown) cache.set(d, lastKnown); // дни без снапшота = последний известный
  }
  if (!lastKnown) {
    console.warn("DeepState: не удалось получить ни одного снапшота.");
    return null;
  }

  return {
    sourceCode: "deepstate",
    lastDate: dsLast < lastDate ? dsLast : lastDate,
    computeDay(date: string): DayGeometry {
      return cache.get(date) ?? cache.get(dsLast)!;
    },
  };
}
