/**
 * ДЕМО-модель потерь: кумулятивные ряды по источникам, интерполированные
 * между годовыми опорными значениями (порядок величин приближен к публичным
 * данным, но числа синтетические — см. manifest.demo).
 *
 * Инвариант проекта: одна запись = один источник; слияния источников нет.
 */
import type {
  EquipmentCategory,
  EquipmentRecord,
  PersonnelEstimate,
} from "@uwt/shared";
import { dateToMs, sourceByCode } from "@uwt/shared";

type Anchor = [date: string, value: number];

function interp(anchors: Anchor[], date: string): number {
  const t = dateToMs(date);
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (t <= dateToMs(first[0])) return first[1];
  if (t >= dateToMs(last[0])) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [d1, v1] = anchors[i]!;
    const [d0, v0] = anchors[i - 1]!;
    const t1 = dateToMs(d1);
    const t0 = dateToMs(d0);
    if (t <= t1) {
      return Math.round(v0 + ((v1 - v0) * (t - t0)) / (t1 - t0));
    }
  }
  return last[1];
}

const A = (values: Record<string, number>): Anchor[] =>
  Object.entries(values).map(([d, v]) => [d, v] as Anchor);

interface PersonnelSeriesDef {
  side: "ru" | "ua";
  sourceCode: string;
  metric: PersonnelEstimate["metric"];
  methodNote: string | null;
  anchorsMin: Anchor[];
  /** null → точечная оценка (max = min). */
  maxFactor: number | null;
}

export const PERSONNEL_SERIES: PersonnelSeriesDef[] = [
  {
    side: "ru",
    sourceCode: "ua_general_staff",
    metric: "casualties_total",
    methodNote: "Заявление стороны конфликта; убитые и раненые суммарно.",
    anchorsMin: A({
      "2022-02-24": 0,
      "2022-12-31": 106_000,
      "2023-12-31": 360_000,
      "2024-12-31": 790_000,
      "2025-12-31": 1_190_000,
    }),
    maxFactor: null,
  },
  {
    side: "ru",
    sourceCode: "bbc_mediazona",
    metric: "killed_confirmed_named",
    methodNote: "Поимённо подтверждённые погибшие — нижняя граница.",
    anchorsMin: A({
      "2022-02-24": 0,
      "2022-12-31": 10_000,
      "2023-12-31": 41_000,
      "2024-12-31": 85_000,
      "2025-12-31": 135_000,
    }),
    maxFactor: null,
  },
  {
    side: "ru",
    sourceCode: "western_estimates",
    metric: "killed",
    methodNote: "Диапазон оценок западных официальных лиц.",
    anchorsMin: A({
      "2022-02-24": 0,
      "2022-12-31": 20_000,
      "2023-12-31": 70_000,
      "2024-12-31": 150_000,
      "2025-12-31": 250_000,
    }),
    maxFactor: 1.6,
  },
  {
    side: "ua",
    sourceCode: "ru_mod",
    metric: "casualties_total",
    methodNote: "Заявление стороны конфликта; методика не раскрывается.",
    anchorsMin: A({
      "2022-02-24": 0,
      "2022-12-31": 100_000,
      "2023-12-31": 383_000,
      "2024-12-31": 600_000,
      "2025-12-31": 800_000,
    }),
    maxFactor: null,
  },
  {
    side: "ua",
    sourceCode: "ualosses",
    metric: "killed_confirmed_named",
    methodNote: "Поимённо подтверждённые погибшие — нижняя граница.",
    anchorsMin: A({
      "2022-02-24": 0,
      "2022-12-31": 9_000,
      "2023-12-31": 24_000,
      "2024-12-31": 46_000,
      "2025-12-31": 70_000,
    }),
    maxFactor: null,
  },
  {
    side: "ua",
    sourceCode: "western_estimates",
    metric: "killed",
    methodNote: "Диапазон оценок западных официальных лиц.",
    anchorsMin: A({
      "2022-02-24": 0,
      "2022-12-31": 13_000,
      "2023-12-31": 42_000,
      "2024-12-31": 60_000,
      "2025-12-31": 80_000,
    }),
    maxFactor: 1.5,
  },
];

interface EquipmentSeriesDef {
  side: "ru" | "ua";
  sourceCode: string;
  category: EquipmentCategory;
  status: EquipmentRecord["status"];
  anchors: Anchor[];
}

const oryxRu = (
  category: EquipmentCategory,
  status: EquipmentRecord["status"],
  values: Record<string, number>,
): EquipmentSeriesDef => ({
  side: "ru",
  sourceCode: "oryx",
  category,
  status,
  anchors: A({ "2022-02-24": 0, ...values }),
});

export const EQUIPMENT_SERIES: EquipmentSeriesDef[] = [
  // Oryx, потери РФ (визуально подтверждённые)
  oryxRu("tank", "destroyed", { "2022-12-31": 1500, "2023-12-31": 2500, "2024-12-31": 3400, "2025-12-31": 4000 }),
  oryxRu("tank", "captured", { "2022-12-31": 540, "2023-12-31": 600, "2024-12-31": 650, "2025-12-31": 680 }),
  oryxRu("ifv", "destroyed", { "2022-12-31": 1700, "2023-12-31": 3000, "2024-12-31": 4300, "2025-12-31": 5200 }),
  oryxRu("apc", "destroyed", { "2022-12-31": 250, "2023-12-31": 450, "2024-12-31": 700, "2025-12-31": 900 }),
  oryxRu("artillery", "destroyed", { "2022-12-31": 270, "2023-12-31": 700, "2024-12-31": 1300, "2025-12-31": 1900 }),
  oryxRu("mlrs", "destroyed", { "2022-12-31": 130, "2023-12-31": 220, "2024-12-31": 280, "2025-12-31": 330 }),
  oryxRu("air_defense", "destroyed", { "2022-12-31": 90, "2023-12-31": 180, "2024-12-31": 280, "2025-12-31": 380 }),
  oryxRu("aircraft", "destroyed", { "2022-12-31": 60, "2023-12-31": 90, "2024-12-31": 120, "2025-12-31": 140 }),
  oryxRu("helicopter", "destroyed", { "2022-12-31": 50, "2023-12-31": 100, "2024-12-31": 120, "2025-12-31": 135 }),
  oryxRu("uav", "destroyed", { "2022-12-31": 150, "2023-12-31": 400, "2024-12-31": 900, "2025-12-31": 1600 }),
  oryxRu("ship", "destroyed", { "2022-12-31": 8, "2023-12-31": 15, "2024-12-31": 25, "2025-12-31": 28 }),
  // Генштаб ВСУ, потери РФ (заявлено)
  { side: "ru", sourceCode: "ua_general_staff", category: "tank", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 3000, "2023-12-31": 6000, "2024-12-31": 9500, "2025-12-31": 11_500 }) },
  { side: "ru", sourceCode: "ua_general_staff", category: "artillery", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 2000, "2023-12-31": 8300, "2024-12-31": 21_000, "2025-12-31": 31_000 }) },
  { side: "ru", sourceCode: "ua_general_staff", category: "aircraft", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 280, "2023-12-31": 330, "2024-12-31": 370, "2025-12-31": 400 }) },
  { side: "ru", sourceCode: "ua_general_staff", category: "helicopter", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 270, "2023-12-31": 325, "2024-12-31": 330, "2025-12-31": 340 }) },
  { side: "ru", sourceCode: "ua_general_staff", category: "uav", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 1600, "2023-12-31": 6500, "2024-12-31": 20_000, "2025-12-31": 40_000 }) },
  { side: "ru", sourceCode: "ua_general_staff", category: "ship", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 16, "2023-12-31": 23, "2024-12-31": 28, "2025-12-31": 30 }) },
  // Oryx, потери Украины
  { side: "ua", sourceCode: "oryx", category: "tank", status: "destroyed", anchors: A({ "2022-02-24": 0, "2022-12-31": 450, "2023-12-31": 800, "2024-12-31": 1100, "2025-12-31": 1300 }) },
  { side: "ua", sourceCode: "oryx", category: "ifv", status: "destroyed", anchors: A({ "2022-02-24": 0, "2022-12-31": 400, "2023-12-31": 800, "2024-12-31": 1200, "2025-12-31": 1500 }) },
  { side: "ua", sourceCode: "oryx", category: "artillery", status: "destroyed", anchors: A({ "2022-02-24": 0, "2022-12-31": 150, "2023-12-31": 400, "2024-12-31": 700, "2025-12-31": 950 }) },
  { side: "ua", sourceCode: "oryx", category: "aircraft", status: "destroyed", anchors: A({ "2022-02-24": 0, "2022-12-31": 35, "2023-12-31": 70, "2024-12-31": 100, "2025-12-31": 120 }) },
  // МО РФ, потери Украины (заявлено)
  { side: "ua", sourceCode: "ru_mod", category: "tank", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 7500, "2023-12-31": 14_000, "2024-12-31": 20_000, "2025-12-31": 24_000 }) },
  { side: "ua", sourceCode: "ru_mod", category: "aircraft", status: "total_claimed", anchors: A({ "2022-02-24": 0, "2022-12-31": 340, "2023-12-31": 560, "2024-12-31": 650, "2025-12-31": 700 }) },
];

export function personnelAt(date: string): PersonnelEstimate[] {
  return PERSONNEL_SERIES.map((s) => {
    const min = interp(s.anchorsMin, date);
    const src = sourceByCode.get(s.sourceCode)!;
    return {
      side: s.side,
      sourceCode: s.sourceCode,
      sourceName: src.name,
      metric: s.metric,
      valueMin: min,
      valueMax: s.maxFactor ? Math.round(min * s.maxFactor) : min,
      methodNote: s.methodNote,
      url: src.url,
    };
  });
}

export function equipmentAt(date: string): EquipmentRecord[] {
  return EQUIPMENT_SERIES.map((s) => {
    const src = sourceByCode.get(s.sourceCode)!;
    return {
      side: s.side,
      sourceCode: s.sourceCode,
      sourceName: src.name,
      category: s.category,
      status: s.status,
      count: interp(s.anchors, date),
      url: src.url,
    };
  });
}
