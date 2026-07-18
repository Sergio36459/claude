/**
 * РЕАЛЬНЫЕ потери по данным Генштаба ВСУ (кумулятивные, ежедневные).
 * Источник: зеркало API russianwarship.rip — датасет PetroIvaniuk
 * (https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset),
 * обновляется ежедневно из официальных сводок.
 *
 * Это ЗАЯВЛЕННЫЕ стороной конфликта цифры (metric: casualties_total /
 * status: total_claimed) — колонка «Генштаб ВСУ», по инварианту проекта
 * не смешивается с другими источниками.
 */
import type {
  ChartFile,
  EquipmentCategory,
  EquipmentRecord,
  PersonnelEstimate,
} from "@uwt/shared";
import { dateToMs, sourceByCode } from "@uwt/shared";
import type { LossesProvider } from "../dataset";

const MIRROR =
  "https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data";

/** Поля Генштаба → категории проекта. ББМ (APC) — БМП+БТР суммарно. */
const CATEGORY_MAP: Array<[string, EquipmentCategory]> = [
  ["tank", "tank"],
  ["APC", "apc"],
  ["field artillery", "artillery"],
  ["MRL", "mlrs"],
  ["anti-aircraft warfare", "air_defense"],
  ["aircraft", "aircraft"],
  ["helicopter", "helicopter"],
  ["drone", "uav"],
  ["naval ship", "ship"],
];

const CATEGORY_RU: Record<string, string> = {
  tank: "танки",
  apc: "ББМ",
  artillery: "артиллерия",
  mlrs: "РСЗО",
  air_defense: "ПВО",
  aircraft: "самолёты",
  helicopter: "вертолёты",
  uav: "БПЛА",
  ship: "корабли",
};

interface PersonnelEntry {
  date: string;
  personnel: number;
}
type EquipmentEntry = { date: string } & Record<string, number | string>;

export interface GenstaffLosses extends LossesProvider {
  lastDate: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return (await res.json()) as T;
}

/** Значение кумулятива на дату = последняя запись ≤ date (сводки публикуются со сдвигом). */
function atOrBefore<T extends { date: string }>(sorted: T[], date: string): T | null {
  const t = dateToMs(date);
  let best: T | null = null;
  for (const e of sorted) {
    if (dateToMs(e.date) > t) break;
    best = e;
  }
  return best;
}

export async function loadGenstaffLosses(): Promise<GenstaffLosses> {
  const [personnelRaw, equipmentRaw] = await Promise.all([
    fetchJson<PersonnelEntry[]>(`${MIRROR}/russia_losses_personnel.json`),
    fetchJson<EquipmentEntry[]>(`${MIRROR}/russia_losses_equipment.json`),
  ]);
  const personnel = [...personnelRaw].sort((a, b) => (a.date < b.date ? -1 : 1));
  const equipment = [...equipmentRaw].sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastDate = personnel[personnel.length - 1]!.date;
  const src = sourceByCode.get("ua_general_staff")!;
  const url = "https://russianwarship.rip";
  const methodNote =
    "Официальные сводки Генштаба ВСУ (агрегатор russianwarship.rip); заявление стороны конфликта.";

  console.log(
    `Генштаб ВСУ: ${personnel.length} дней потерь л/с, ${equipment.length} дней техники, по ${lastDate}`,
  );

  return {
    lastDate,

    personnelAt(date: string): PersonnelEstimate[] {
      const e = atOrBefore(personnel, date);
      if (!e) return [];
      return [
        {
          side: "ru",
          sourceCode: src.code,
          sourceName: src.name,
          metric: "casualties_total",
          valueMin: e.personnel,
          valueMax: e.personnel,
          methodNote,
          url,
        },
      ];
    },

    equipmentAt(date: string): EquipmentRecord[] {
      const e = atOrBefore(equipment, date);
      if (!e) return [];
      const out: EquipmentRecord[] = [];
      for (const [field, category] of CATEGORY_MAP) {
        const v = e[field];
        if (typeof v !== "number") continue;
        out.push({
          side: "ru",
          sourceCode: src.code,
          sourceName: src.name,
          category,
          status: "total_claimed",
          count: v,
          url,
        });
      }
      return out;
    },

    personnelSeries(dates: string[]): ChartFile["series"] {
      return [
        {
          id: "ru:ua_general_staff:casualties_total",
          label: "РФ — потери суммарно (Генштаб ВСУ, заявлено)",
          sourceCode: src.code,
          side: "ru",
          points: dates
            .map((d) => {
              const e = atOrBefore(personnel, d);
              return e ? ([d, e.personnel] as [string, number]) : null;
            })
            .filter((p): p is [string, number] => p !== null),
        },
      ];
    },

    equipmentSeries(dates: string[]): ChartFile["series"] {
      return CATEGORY_MAP.map(([field, category]) => ({
        id: `ru:ua_general_staff:${category}:total_claimed`,
        label: `Генштаб ВСУ: ${CATEGORY_RU[category] ?? category}, заявлено`,
        sourceCode: src.code,
        side: "ru" as const,
        points: dates
          .map((d) => {
            const e = atOrBefore(equipment, d);
            const v = e?.[field];
            return typeof v === "number" ? ([d, v] as [string, number]) : null;
          })
          .filter((p): p is [string, number] => p !== null),
      }));
    },
  };
}
