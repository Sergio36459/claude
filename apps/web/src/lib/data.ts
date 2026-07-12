"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import type {
  ChartFile,
  DayBundle,
  KeyEventMarker,
  Manifest,
  PlaceIndexEntry,
} from "@uwt/shared";
import type { FeatureCollection } from "geojson";
import { DATA_URL } from "./config";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export const qk = {
  manifest: ["manifest"] as const,
  bundle: (d: string) => ["bundle", d] as const,
  control: (d: string, lod: 0 | 1) => ["control", d, lod] as const,
  frontline: (d: string, lod: 0 | 1) => ["frontline", d, lod] as const,
  diff: (d: string) => ["diff", d] as const,
  series: (name: string) => ["series", name] as const,
  places: ["places"] as const,
  keyEvents: ["key-events"] as const,
};

export const fetchers = {
  manifest: () => fetchJson<Manifest>("/manifest.json"),
  bundle: (d: string) => fetchJson<DayBundle>(`/days/${d}/bundle.json`),
  control: (d: string, lod: 0 | 1) =>
    fetchJson<FeatureCollection>(`/days/${d}/control.z${lod}.geojson`),
  frontline: (d: string, lod: 0 | 1) =>
    fetchJson<FeatureCollection>(
      lod === 0 ? `/days/${d}/frontline.z0.geojson` : `/days/${d}/frontline.geojson`,
    ),
  diff: (d: string) => fetchJson<FeatureCollection>(`/days/${d}/diff.geojson`),
  series: (name: string) => fetchJson<ChartFile>(`/series/${name}.json`),
  places: () => fetchJson<PlaceIndexEntry[]>("/places.json"),
  keyEvents: () => fetchJson<KeyEventMarker[]>("/series/key-events.json"),
};

/** Исторические данные неизменяемы → staleTime ∞ (docs/03 §6). */
const STATIC_OPTS = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

export function useManifest() {
  return useQuery({ queryKey: qk.manifest, queryFn: fetchers.manifest, ...STATIC_OPTS });
}

export function useDayBundle(date: string | null) {
  return useQuery({
    queryKey: qk.bundle(date ?? ""),
    queryFn: () => fetchers.bundle(date!),
    enabled: !!date,
    ...STATIC_OPTS,
  });
}

export function useSeries(name: string) {
  return useQuery({
    queryKey: qk.series(name),
    queryFn: () => fetchers.series(name),
    ...STATIC_OPTS,
  });
}

export function usePlaces() {
  return useQuery({ queryKey: qk.places, queryFn: fetchers.places, ...STATIC_OPTS });
}

export function useKeyEvents() {
  return useQuery({ queryKey: qk.keyEvents, queryFn: fetchers.keyEvents, ...STATIC_OPTS });
}

/** Предзагрузка окна дат при воспроизведении/навигации (docs/05 §4). */
export function prefetchDay(qc: QueryClient, date: string, lod: 0 | 1): void {
  void qc.prefetchQuery({
    queryKey: qk.control(date, lod),
    queryFn: () => fetchers.control(date, lod),
    ...STATIC_OPTS,
  });
  void qc.prefetchQuery({
    queryKey: qk.frontline(date, lod),
    queryFn: () => fetchers.frontline(date, lod),
    ...STATIC_OPTS,
  });
  void qc.prefetchQuery({
    queryKey: qk.diff(date),
    queryFn: () => fetchers.diff(date),
    ...STATIC_OPTS,
  });
  void qc.prefetchQuery({
    queryKey: qk.bundle(date),
    queryFn: () => fetchers.bundle(date),
    ...STATIC_OPTS,
  });
}

export async function loadDayGeo(qc: QueryClient, date: string, lod: 0 | 1) {
  const [control, frontline, diff] = await Promise.all([
    qc.fetchQuery({
      queryKey: qk.control(date, lod),
      queryFn: () => fetchers.control(date, lod),
      ...STATIC_OPTS,
    }),
    qc.fetchQuery({
      queryKey: qk.frontline(date, lod),
      queryFn: () => fetchers.frontline(date, lod),
      ...STATIC_OPTS,
    }),
    qc.fetchQuery({
      queryKey: qk.diff(date),
      queryFn: () => fetchers.diff(date),
      ...STATIC_OPTS,
    }),
  ]);
  return { control, frontline, diff };
}
