"use client";

import maplibregl, { Map as MlMap, type StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { easeInOutCubic, lerpLine, resampleLine, type LngLat } from "@uwt/geo";
import { BASE_STYLE_DARK, BASE_STYLE_LIGHT, MAP_INITIAL } from "./config";
import type { LayerToggles } from "@/stores/uiStore";

export interface DayGeo {
  control: FeatureCollection;
  frontline: FeatureCollection;
  diff: FeatureCollection;
}

export interface ShowDayOptions {
  animate: boolean;
  durationMs: number;
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const FRONT_N = 180; // вершин на сегмент при интерполяции

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function loadStyle(theme: "light" | "dark"): Promise<StyleSpecification | string> {
  const url = theme === "dark" ? BASE_STYLE_DARK : BASE_STYLE_LIGHT;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as StyleSpecification;
  } catch {
    // офлайн/заблокированная подложка — минимальный локальный стиль (docs/07: не блокируем работу)
    return {
      version: 8,
      name: "uwt-fallback",
      sources: {},
      layers: [
        {
          id: "bg",
          type: "background",
          paint: { "background-color": theme === "dark" ? "#101010" : "#e9e7e2" },
        },
      ],
    };
  }
}

/**
 * Владеет инстансом MapLibre вне React-реконсиляции (docs/03 §3.3).
 * Анимация смены даты: кроссфейд зон контроля (GPU-переходы paint-свойств),
 * покадровая интерполяция линии фронта, пульсация диф-слоя.
 */
export class MapController {
  private map: MlMap | null = null;
  private ready = false;
  private destroyed = false;
  /** Желаемая тема (может смениться, пока стиль ещё грузится). */
  private theme: "light" | "dark";
  /** Тема, реально применённая к стилю карты. */
  private appliedTheme: "light" | "dark";
  private controlToggle = false; // какой из двух control-слоёв активен
  private currentFront = new Map<string, LngLat[]>();
  private frontAnim: number | null = null;
  private diffAnim: number | null = null;
  private showSeq = 0;
  private lastGeo: DayGeo | null = null;
  private lastEvents: FeatureCollection = EMPTY;
  private layerToggles: LayerToggles = {
    control: true,
    frontline: true,
    diff: true,
    events: true,
  };
  onEventClick: ((id: number) => void) | null = null;

  constructor(container: HTMLElement, theme: "light" | "dark") {
    this.theme = theme;
    this.appliedTheme = theme;
    void this.init(container);
  }

  private async init(container: HTMLElement): Promise<void> {
    this.appliedTheme = this.theme;
    const style = await loadStyle(this.appliedTheme);
    if (this.destroyed) return;
    const map = new maplibregl.Map({
      container,
      style,
      center: MAP_INITIAL.center,
      zoom: MAP_INITIAL.zoom,
      minZoom: 4,
      maxZoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    this.map = map;
    map.on("load", () => {
      this.addLayers();
      this.ready = true;
      this.restoreState();
      // тема могла смениться, пока грузился стиль (гидратация настроек)
      if (this.theme !== this.appliedTheme) void this.applyTheme(this.theme);
    });
    map.on("click", "uwt-events", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const id = f.properties?.id as number | undefined;
      if (id != null) this.onEventClick?.(id);
      const title = (f.properties?.title as string) ?? "";
      const time = (f.properties?.timeUtc as string) ?? "";
      new maplibregl.Popup({ closeButton: false, maxWidth: "280px" })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:13px;padding:2px 4px"><strong>${escapeHtml(title)}</strong>${
            time ? `<div style="opacity:.7;margin-top:2px">${time} UTC</div>` : ""
          }</div>`,
        )
        .addTo(this.map!);
    });
    map.on("mouseenter", "uwt-events", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "uwt-events", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  private firstSymbolLayerId(): string | undefined {
    const layers = this.map?.getStyle()?.layers ?? [];
    return layers.find((l) => l.type === "symbol")?.id;
  }

  private addLayers(): void {
    const map = this.map!;
    const before = this.firstSymbolLayerId();
    const ruFill = cssVar("--map-ru-fill") || "#d03b3b";
    const ruLine = cssVar("--map-ru-line") || "#b91c1c";
    const gainRu = cssVar("--map-gain-ru") || "#d03b3b";
    const gainUa = cssVar("--map-gain-ua") || "#2a78d6";

    for (const key of ["uwt-control-a", "uwt-control-b"]) {
      map.addSource(key, { type: "geojson", data: EMPTY });
      map.addLayer(
        {
          id: key,
          type: "fill",
          source: key,
          // GPU-переход для кроссфейда задаётся в showDay через
          // setPaintProperty("fill-opacity-transition", …) — docs/06 §5.2
          paint: {
            "fill-color": ruFill,
            "fill-opacity": 0,
          },
        },
        before,
      );
    }

    map.addSource("uwt-diff", { type: "geojson", data: EMPTY });
    map.addLayer(
      {
        id: "uwt-diff",
        type: "fill",
        source: "uwt-diff",
        paint: {
          "fill-color": [
            "match",
            ["get", "kind"],
            "gained_ru",
            gainRu,
            "gained_ua",
            gainUa,
            "#888888",
          ],
          "fill-opacity": 0.35,
        },
      },
      before,
    );

    map.addSource("uwt-frontline", { type: "geojson", data: EMPTY });
    map.addLayer(
      {
        id: "uwt-frontline",
        type: "line",
        source: "uwt-frontline",
        paint: {
          "line-color": ruLine,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 3.2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      },
      before,
    );

    map.addSource("uwt-events", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "uwt-events",
      type: "circle",
      source: "uwt-events",
      paint: {
        "circle-radius": ["case", ["get", "isKeyEvent"], 7, 4.5],
        "circle-color": [
          "match",
          ["get", "type"],
          "combat", "#e34948",
          "front_change", "#2a78d6",
          "missile_strike", "#eda100",
          "uav_strike", "#eb6834",
          "airstrike", "#e87ba4",
          "#898781",
        ],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": this.theme === "dark" ? "#1a1a19" : "#ffffff",
        "circle-opacity": 0.9,
      },
    });
  }

  /** После setStyle/init восстановить данные и видимость слоёв. */
  private restoreState(): void {
    if (this.lastGeo) {
      const active = this.activeControlId();
      this.setSourceData(active, this.lastGeo.control);
      this.map?.setPaintProperty(active, "fill-opacity", 0.28);
      this.setSourceData("uwt-frontline", this.lastGeo.frontline);
      this.setSourceData("uwt-diff", this.lastGeo.diff);
    }
    this.setSourceData("uwt-events", this.lastEvents);
    this.applyLayerToggles(this.layerToggles);
  }

  private activeControlId(): string {
    return this.controlToggle ? "uwt-control-b" : "uwt-control-a";
  }

  private setSourceData(id: string, data: FeatureCollection): void {
    const src = this.map?.getSource(id) as maplibregl.GeoJSONSource | undefined;
    src?.setData(data);
  }

  /** Показ дня: см. docs/06 §5 — кроссфейд + интерполяция + пульс дифа. */
  showDay(geo: DayGeo, opts: ShowDayOptions): void {
    const seq = ++this.showSeq;
    if (!this.ready || !this.map) {
      this.lastGeo = geo;
      return;
    }
    if (seq !== this.showSeq) return;

    const prevGeo = this.lastGeo;
    this.lastGeo = geo;

    // 1) зоны контроля — кроссфейд двух слоёв
    const from = this.activeControlId();
    this.controlToggle = !this.controlToggle;
    const to = this.activeControlId();
    const dur =
      opts.animate && prevGeo ? Math.max(80, Math.min(opts.durationMs, 600)) : 0;
    this.map.setPaintProperty(from, "fill-opacity-transition", { duration: dur, delay: 0 });
    this.map.setPaintProperty(to, "fill-opacity-transition", { duration: dur, delay: 0 });
    this.setSourceData(to, geo.control);
    this.map.setPaintProperty(to, "fill-opacity", 0.28);
    this.map.setPaintProperty(from, "fill-opacity", 0);

    // 2) линия фронта — покадровая интерполяция по segmentId
    this.animateFrontline(geo.frontline, opts);

    // 3) диф-слой — данные + пульсация
    this.setSourceData("uwt-diff", geo.diff);
    this.pulseDiff(opts);
  }

  private animateFrontline(fc: FeatureCollection, opts: ShowDayOptions): void {
    if (this.frontAnim) cancelAnimationFrame(this.frontAnim);
    const targets = new Map<string, LngLat[]>();
    for (const f of fc.features) {
      if (f.geometry.type !== "LineString") continue;
      const id = String((f.properties as Record<string, unknown>)?.segmentId ?? "");
      targets.set(id, resampleLine(f.geometry.coordinates as LngLat[], FRONT_N));
    }

    const canLerp =
      opts.animate &&
      this.currentFront.size > 0 &&
      [...targets.keys()].some((id) => this.currentFront.has(id));

    if (!canLerp) {
      this.currentFront = targets;
      this.setSourceData("uwt-frontline", fc);
      return;
    }

    const fromMap = this.currentFront;
    const dur = Math.max(120, Math.min(opts.durationMs, 500));
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOutCubic(t);
      const features: Feature<LineString>[] = [];
      const current = new Map<string, LngLat[]>();
      for (const [id, target] of targets) {
        const from = fromMap.get(id);
        const line = from ? lerpLine(from, target, e) : target;
        current.set(id, line);
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: line },
          properties: { segmentId: id },
        });
      }
      this.currentFront = current;
      this.setSourceData("uwt-frontline", { type: "FeatureCollection", features });
      if (t < 1) {
        this.frontAnim = requestAnimationFrame(frame);
      } else {
        this.frontAnim = null;
      }
    };
    this.frontAnim = requestAnimationFrame(frame);
  }

  private pulseDiff(opts: ShowDayOptions): void {
    if (this.diffAnim) cancelAnimationFrame(this.diffAnim);
    if (!this.map) return;
    if (!opts.animate || opts.durationMs < 250) {
      this.map.setPaintProperty("uwt-diff", "fill-opacity", 0.35);
      return;
    }
    const dur = 1400;
    const t0 = performance.now();
    const frame = (now: number) => {
      if (!this.map) return;
      const t = Math.min(1, (now - t0) / dur);
      // две пульсации с затуханием → стационарные 0.35
      const opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t);
      this.map.setPaintProperty("uwt-diff", "fill-opacity", opacity);
      if (t < 1) this.diffAnim = requestAnimationFrame(frame);
      else this.diffAnim = null;
    };
    this.diffAnim = requestAnimationFrame(frame);
  }

  setEvents(fc: FeatureCollection): void {
    this.lastEvents = fc;
    if (this.ready) this.setSourceData("uwt-events", fc);
  }

  applyLayerToggles(t: LayerToggles): void {
    this.layerToggles = t;
    if (!this.ready || !this.map) return;
    const vis = (v: boolean) => (v ? "visible" : "none");
    for (const id of ["uwt-control-a", "uwt-control-b"]) {
      this.map.setLayoutProperty(id, "visibility", vis(t.control));
    }
    this.map.setLayoutProperty("uwt-frontline", "visibility", vis(t.frontline));
    this.map.setLayoutProperty("uwt-diff", "visibility", vis(t.diff));
    this.map.setLayoutProperty("uwt-events", "visibility", vis(t.events));
  }

  async setTheme(theme: "light" | "dark"): Promise<void> {
    this.theme = theme;
    // карта ещё инициализируется — обработчик 'load' дожмёт нужную тему
    if (!this.map || !this.ready) return;
    if (theme === this.appliedTheme) return;
    await this.applyTheme(theme);
  }

  private async applyTheme(theme: "light" | "dark"): Promise<void> {
    if (!this.map) return;
    this.appliedTheme = theme;
    const style = await loadStyle(theme);
    if (this.destroyed || !this.map) return;
    this.ready = false;
    this.map.setStyle(style as StyleSpecification);
    this.map.once("styledata", () => {
      // источники/слои погибли вместе со стилем — пересоздаём и восстанавливаем
      this.addLayers();
      this.ready = true;
      this.restoreState();
      if (this.theme !== this.appliedTheme) void this.applyTheme(this.theme);
    });
  }

  flyTo(coords: [number, number], zoom = 8): void {
    this.map?.flyTo({ center: coords, zoom, duration: 1200 });
  }

  getZoom(): number {
    return this.map?.getZoom() ?? MAP_INITIAL.zoom;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.frontAnim) cancelAnimationFrame(this.frontAnim);
    if (this.diffAnim) cancelAnimationFrame(this.diffAnim);
    this.map?.remove();
    this.map = null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Шина карта↔панели: панели не знают о MapLibre (docs/03 §3.1). */
export const mapBus: {
  flyTo: ((coords: [number, number], zoom?: number) => void) | null;
} = { flyTo: null };
