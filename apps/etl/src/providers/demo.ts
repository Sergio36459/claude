/** Адаптеры синтетических (демо) источников к интерфейсам сборщика. */
import type { ChartFile } from "@uwt/shared";
import type { EventsProvider, LossesProvider } from "../dataset";
import { generateEventsForDay, keyEventsOnlyForDay } from "../events";
import {
  EQUIPMENT_SERIES,
  PERSONNEL_SERIES,
  equipmentAt,
  personnelAt,
} from "../losses";

const METRIC_LABEL: Record<string, string> = {
  killed: "погибшие (оценка)",
  killed_confirmed_named: "погибшие (поимённо)",
  casualties_total: "потери суммарно (заявлено)",
};

const STATUS_LABEL: Record<string, string> = {
  destroyed: "уничтожено",
  captured: "захвачено",
  damaged: "повреждено",
  abandoned: "брошено",
  total_claimed: "заявлено",
};

const CATEGORY_LABEL: Record<string, string> = {
  tank: "танки",
  ifv: "БМП",
  apc: "БТР",
  artillery: "артиллерия",
  mlrs: "РСЗО",
  air_defense: "ПВО",
  aircraft: "самолёты",
  helicopter: "вертолёты",
  uav: "БПЛА",
  ship: "корабли",
  other: "прочее",
};

export function demoLossesProvider(): LossesProvider {
  return {
    personnelAt,
    equipmentAt,
    personnelSeries(dates: string[]): ChartFile["series"] {
      return PERSONNEL_SERIES.map((s) => ({
        id: `${s.side}:${s.sourceCode}:${s.metric}`,
        label: `${s.side === "ru" ? "РФ" : "Украина"} — ${METRIC_LABEL[s.metric]}`,
        sourceCode: s.sourceCode,
        side: s.side,
        points: dates.map((m) => {
          const est = personnelAt(m).find(
            (p) => p.side === s.side && p.sourceCode === s.sourceCode && p.metric === s.metric,
          )!;
          return est.valueMin === est.valueMax
            ? [m, est.valueMin]
            : [m, est.valueMin, est.valueMax];
        }),
      }));
    },
    equipmentSeries(dates: string[]): ChartFile["series"] {
      return EQUIPMENT_SERIES.map((s) => ({
        id: `${s.side}:${s.sourceCode}:${s.category}:${s.status}`,
        label: `${s.sourceCode === "oryx" ? "Oryx" : s.sourceCode === "ua_general_staff" ? "Генштаб ВСУ" : "МО РФ"}: ${CATEGORY_LABEL[s.category] ?? s.category}, ${STATUS_LABEL[s.status] ?? s.status}`,
        sourceCode: s.sourceCode,
        side: s.side,
        points: dates.map((m) => {
          const rec = equipmentAt(m).find(
            (r) =>
              r.side === s.side &&
              r.sourceCode === s.sourceCode &&
              r.category === s.category &&
              r.status === s.status,
          )!;
          return [m, rec.count];
        }),
      }));
    },
  };
}

export function demoEventsProvider(): EventsProvider {
  return { forDay: generateEventsForDay };
}

export function keyEventsOnlyProvider(): EventsProvider {
  return { forDay: (date) => keyEventsOnlyForDay(date) };
}
