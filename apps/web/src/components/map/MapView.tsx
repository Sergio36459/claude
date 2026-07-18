"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { FIRST_DATE, addMonths, clampDate } from "@uwt/shared";
import { fetchers, loadDayGeo, qk, useDayBundle } from "@/lib/data";
import { MapController, mapBus } from "@/lib/mapController";
import { useDateStore } from "@/stores/dateStore";
import { useUiStore } from "@/stores/uiStore";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Обёртка над MapController: единственный инстанс карты вне React-дерева. */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const qc = useQueryClient();

  const date = useDateStore((s) => s.date);
  const playing = useDateStore((s) => s.playing);
  const speed = useDateStore((s) => s.speed);
  const scrubbing = useDateStore((s) => s.scrubbing);
  const theme = useUiStore((s) => s.theme);
  const layers = useUiStore((s) => s.layers);
  const ghostMonths = useUiStore((s) => s.ghostMonths);
  const { data: bundle } = useDayBundle(date);

  // создание/уничтожение карты (идемпотентно к StrictMode double-mount)
  useEffect(() => {
    if (!containerRef.current || controllerRef.current) return;
    const controller = new MapController(containerRef.current, useUiStore.getState().theme);
    controllerRef.current = controller;
    mapBus.flyTo = (coords, zoom) => controller.flyTo(coords, zoom);
    return () => {
      mapBus.flyTo = null;
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  // смена даты → загрузка геоданных и анимация
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    let cancelled = false;
    const fastPlayback = playing && speed >= 2;
    const lod: 0 | 1 = scrubbing || fastPlayback || controller.getZoom() < 5.5 ? 0 : 1;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void loadDayGeo(qc, date, lod).then((geo) => {
      if (cancelled) return;
      controller.showDay(geo, {
        animate: !scrubbing && !reduced,
        durationMs: playing ? Math.min(420, 900 / speed) : 420,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [date, scrubbing, playing, speed, qc]);

  // события дня → слой точек
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !bundle) return;
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: bundle.events
        .filter((e) => e.coords)
        .map((e) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: e.coords! },
          properties: {
            id: e.id,
            type: e.type,
            title: e.title,
            timeUtc: e.timeUtc,
            isKeyEvent: e.isKeyEvent,
          },
        })),
    };
    controller.setEvents(fc);
  }, [bundle]);

  useEffect(() => {
    controllerRef.current?.applyLayerToggles(layers);
  }, [layers]);

  // «призрак» линии фронта N месяцев назад (режим сравнения дат)
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (ghostMonths === 0) {
      controller.setGhost(EMPTY_FC);
      return;
    }
    let cancelled = false;
    const lastDate = useDateStore.getState().lastDate;
    const ghostDate = clampDate(addMonths(date, -ghostMonths), FIRST_DATE, lastDate);
    void qc
      .fetchQuery({
        queryKey: qk.frontline(ghostDate, 1),
        queryFn: () => fetchers.frontline(ghostDate, 1),
        staleTime: Infinity,
      })
      .then((fc) => {
        if (!cancelled) controller.setGhost(fc);
      })
      .catch(() => {
        if (!cancelled) controller.setGhost(EMPTY_FC);
      });
    return () => {
      cancelled = true;
    };
  }, [date, ghostMonths, qc]);

  useEffect(() => {
    void controllerRef.current?.setTheme(theme);
  }, [theme]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="Карта боевых действий" />;
}
