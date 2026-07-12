/** База статического data-контракта (CDN в проде, /public/data в dev). */
export const DATA_URL = process.env.NEXT_PUBLIC_DATA_URL ?? "/data";

/** Скорости воспроизведения: 1x = 1 день/секунду. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 30, 60] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const MAP_INITIAL = { center: [31.4, 48.5] as [number, number], zoom: 5.3 };

/** Стили подложки (CARTO, без ключа). В проде заменяется на self-hosted PMTiles (docs/06 §6). */
export const BASE_STYLE_LIGHT =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export const BASE_STYLE_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
