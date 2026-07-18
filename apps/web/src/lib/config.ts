/** Префикс приложения при деплое в подпапку (GitHub Pages: /имя-репозитория). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** База статического data-контракта (CDN в проде, /public/data в dev). */
export const DATA_URL = process.env.NEXT_PUBLIC_DATA_URL ?? `${BASE_PATH}/data`;

/** Скорости воспроизведения: 1x = 1 день/секунду. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 30, 60] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const MAP_INITIAL = { center: [31.4, 48.5] as [number, number], zoom: 5.3 };

/** «Мировая карта» ограничена регионом: Украина + европейская часть РФ + соседи. */
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [15, 38],
  [65, 62],
];

/**
 * По умолчанию — собственная подложка из /public/basemap (Natural Earth).
 * Внешний стиль (CARTO/PMTiles) подключается опционально через env.
 */
export const BASE_STYLE_LIGHT = process.env.NEXT_PUBLIC_BASE_STYLE_LIGHT ?? null;
export const BASE_STYLE_DARK = process.env.NEXT_PUBLIC_BASE_STYLE_DARK ?? null;
