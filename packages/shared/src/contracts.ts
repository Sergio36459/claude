import { z } from "zod";

/** Первый день данных — начало полномасштабного вторжения. */
export const FIRST_DATE = "2022-02-24";

export const eventTypeSchema = z.enum([
  "front_change",
  "combat",
  "missile_strike",
  "uav_strike",
  "airstrike",
  "international",
  "political",
  "economic",
  "sanctions",
  "statement",
  "other",
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const confidenceSchema = z.enum([
  "confirmed",
  "reported",
  "claimed",
  "disputed",
]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const lossSideSchema = z.enum(["ru", "ua"]);
export type LossSide = z.infer<typeof lossSideSchema>;

export const equipmentCategorySchema = z.enum([
  "tank",
  "ifv",
  "apc",
  "artillery",
  "mlrs",
  "air_defense",
  "aircraft",
  "helicopter",
  "uav",
  "ship",
  "other",
]);
export type EquipmentCategory = z.infer<typeof equipmentCategorySchema>;

export const sourceRefSchema = z.object({
  code: z.string(),
  name: z.string(),
  url: z.string(),
  publishedAt: z.string().nullable().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const eventSchema = z.object({
  id: z.number(),
  date: z.string(),
  timeUtc: z.string().nullable(),
  type: eventTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  /** [lng, lat]; null — событие без геопривязки (санкции, заявления…) */
  coords: z.tuple([z.number(), z.number()]).nullable(),
  placeName: z.string().nullable(),
  confidence: confidenceSchema,
  isKeyEvent: z.boolean(),
  sources: z.array(sourceRefSchema).min(1),
});
export type WarEvent = z.infer<typeof eventSchema>;

export const dailyStatsSchema = z.object({
  date: z.string(),
  /** Порядковый день войны, 24.02.2022 = 1 */
  dayNumber: z.number(),
  areaRuSqkm: z.number(),
  areaChangeSqkm: z.number(),
  frontlineLenKm: z.number(),
  eventsTotal: z.number(),
  eventsByType: z.record(z.number()),
  strikesMissile: z.number(),
  strikesUav: z.number(),
});
export type DailyStats = z.infer<typeof dailyStatsSchema>;

/**
 * Оценка потерь личного состава: КУМУЛЯТИВ на дату.
 * Инвариант проекта: одна запись = один источник; агрегатов между
 * источниками не существует ни в данных, ни в API.
 */
export const personnelEstimateSchema = z.object({
  side: lossSideSchema,
  sourceCode: z.string(),
  sourceName: z.string(),
  metric: z.enum(["killed", "killed_confirmed_named", "casualties_total"]),
  valueMin: z.number(),
  valueMax: z.number(),
  methodNote: z.string().nullable(),
  url: z.string(),
});
export type PersonnelEstimate = z.infer<typeof personnelEstimateSchema>;

export const equipmentRecordSchema = z.object({
  side: lossSideSchema,
  sourceCode: z.string(),
  sourceName: z.string(),
  category: equipmentCategorySchema,
  status: z.enum(["destroyed", "damaged", "abandoned", "captured", "total_claimed"]),
  count: z.number(),
  url: z.string(),
});
export type EquipmentRecord = z.infer<typeof equipmentRecordSchema>;

export const diffSummarySchema = z.object({
  gainedRuSqkm: z.number(),
  gainedUaSqkm: z.number(),
});
export type DiffSummary = z.infer<typeof diffSummarySchema>;

/** Дневной бандл — всё состояние страницы на выбранную дату. */
export const dayBundleSchema = z.object({
  date: z.string(),
  preliminary: z.boolean(),
  stats: dailyStatsSchema,
  events: z.array(eventSchema),
  losses: z.object({
    personnel: z.array(personnelEstimateSchema),
    equipment: z.array(equipmentRecordSchema),
  }),
  diffSummary: diffSummarySchema,
});
export type DayBundle = z.infer<typeof dayBundleSchema>;

export const manifestSchema = z.object({
  schemaVersion: z.number(),
  generatedAt: z.string(),
  /** Демо-данные: синтетическое приближение, не для цитирования. */
  demo: z.boolean(),
  firstDate: z.string(),
  lastDate: z.string(),
  days: z.record(z.object({ v: z.number(), preliminary: z.boolean() })),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** Временной ряд для графиков: серия = источник/сторона/метрика. */
export const chartSeriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceCode: z.string().nullable(),
  side: lossSideSchema.nullable(),
  /** [dateISO, value] либо [dateISO, min, max] */
  points: z.array(z.array(z.union([z.string(), z.number()]))),
});
export const chartFileSchema = z.object({
  name: z.string(),
  unit: z.string(),
  series: z.array(chartSeriesSchema),
});
export type ChartFile = z.infer<typeof chartFileSchema>;
export type ChartSeries = z.infer<typeof chartSeriesSchema>;

export const keyEventMarkerSchema = z.object({
  date: z.string(),
  title: z.string(),
});
export type KeyEventMarker = z.infer<typeof keyEventMarkerSchema>;

export const placeIndexEntrySchema = z.object({
  name: z.string(),
  kind: z.enum(["city", "oblast", "operation"]),
  coords: z.tuple([z.number(), z.number()]),
  zoom: z.number().optional(),
});
export type PlaceIndexEntry = z.infer<typeof placeIndexEntrySchema>;
