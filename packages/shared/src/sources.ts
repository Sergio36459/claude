/**
 * Реестр источников данных (см. docs/01, docs/04).
 * Порядок = приоритет по ТЗ.
 */
export interface SourceInfo {
  code: string;
  name: string;
  url: string;
  kind:
    | "research"
    | "conflict_db"
    | "visual_confirm"
    | "operational_map"
    | "official_ua"
    | "official_ru"
    | "named_casualties"
    | "estimate";
  reliabilityNote: string;
}

export const SOURCES: readonly SourceInfo[] = [
  {
    code: "isw",
    name: "ISW",
    url: "https://www.understandingwar.org",
    kind: "research",
    reliabilityNote:
      "Institute for the Study of War — ежедневные аналитические сводки.",
  },
  {
    code: "acled",
    name: "ACLED",
    url: "https://acleddata.com",
    kind: "conflict_db",
    reliabilityNote:
      "База событий политического насилия; требует атрибуции.",
  },
  {
    code: "oryx",
    name: "Oryx",
    url: "https://www.oryxspioenkop.com",
    kind: "visual_confirm",
    reliabilityNote:
      "Только визуально подтверждённые потери техники — нижняя граница реальных потерь.",
  },
  {
    code: "deepstate",
    name: "DeepState",
    url: "https://deepstatemap.live",
    kind: "operational_map",
    reliabilityNote:
      "Оперативная карта; геометрия сверяется с ISW перед публикацией.",
  },
  {
    code: "owlmaps",
    name: "UA Control Map",
    url: "https://uacontrolmap.com",
    kind: "operational_map",
    reliabilityNote:
      "Карта контроля Project Owl (uacontrolmap.com); ежедневные архивы публикуются на GitHub (owlmaps/UAControlMapBackups).",
  },
  {
    code: "ua_general_staff",
    name: "Генштаб ВСУ",
    url: "https://www.zsu.gov.ua",
    kind: "official_ua",
    reliabilityNote:
      "Официальные заявления украинской стороны — отображаются отдельной колонкой.",
  },
  {
    code: "ru_mod",
    name: "МО РФ",
    url: "https://mil.ru",
    kind: "official_ru",
    reliabilityNote:
      "Официальные заявления российской стороны — отображаются отдельной колонкой.",
  },
  {
    code: "bbc_mediazona",
    name: "BBC/Mediazona",
    url: "https://zona.media/casualties",
    kind: "named_casualties",
    reliabilityNote:
      "Поимённо подтверждённые погибшие (РФ) — только подтверждённые случаи, нижняя граница.",
  },
  {
    code: "ualosses",
    name: "UALosses",
    url: "https://ualosses.org",
    kind: "named_casualties",
    reliabilityNote:
      "Поимённо подтверждённые погибшие (Украина) — только подтверждённые случаи, нижняя граница.",
  },
  {
    code: "western_estimates",
    name: "Западные оценки",
    url: "https://www.defense.gov",
    kind: "estimate",
    reliabilityNote:
      "Оценки западных официальных лиц/разведок; публикуются диапазоном min–max.",
  },
] as const;

export const sourceByCode = new Map(SOURCES.map((s) => [s.code, s]));
