/**
 * ДЕМО-генератор событий: ключевые события — реальные и подтверждённые
 * (даты/места из открытых источников), фоновые события — синтетические
 * шаблоны, распределённые вдоль линии фронта и по городам.
 */
import type { LngLat } from "@uwt/geo";
import type { Confidence, EventType, WarEvent } from "@uwt/shared";
import { dateToMs, sourceByCode } from "@uwt/shared";
import { mulberry32, hashString, pick, randInt } from "./rng";

export interface City {
  name: string;
  coords: LngLat;
  oblast: string;
}

export const CITIES: City[] = [
  { name: "Киев", coords: [30.52, 50.45], oblast: "Киевская область" },
  { name: "Харьков", coords: [36.23, 49.99], oblast: "Харьковская область" },
  { name: "Одесса", coords: [30.73, 46.48], oblast: "Одесская область" },
  { name: "Днепр", coords: [35.05, 48.45], oblast: "Днепропетровская область" },
  { name: "Львов", coords: [24.03, 49.84], oblast: "Львовская область" },
  { name: "Запорожье", coords: [35.14, 47.84], oblast: "Запорожская область" },
  { name: "Николаев", coords: [31.99, 46.97], oblast: "Николаевская область" },
  { name: "Винница", coords: [28.47, 49.23], oblast: "Винницкая область" },
  { name: "Полтава", coords: [34.55, 49.59], oblast: "Полтавская область" },
  { name: "Чернигов", coords: [31.28, 51.49], oblast: "Черниговская область" },
  { name: "Сумы", coords: [34.8, 50.91], oblast: "Сумская область" },
  { name: "Житомир", coords: [28.66, 50.25], oblast: "Житомирская область" },
  { name: "Черкассы", coords: [32.06, 49.44], oblast: "Черкасская область" },
  { name: "Хмельницкий", coords: [26.98, 49.42], oblast: "Хмельницкая область" },
  { name: "Ивано-Франковск", coords: [24.71, 48.92], oblast: "Ивано-Франковская область" },
  { name: "Луцк", coords: [25.32, 50.75], oblast: "Волынская область" },
  { name: "Ровно", coords: [26.25, 50.62], oblast: "Ровенская область" },
  { name: "Тернополь", coords: [25.59, 49.55], oblast: "Тернопольская область" },
  { name: "Ужгород", coords: [22.3, 48.62], oblast: "Закарпатская область" },
  { name: "Черновцы", coords: [25.93, 48.29], oblast: "Черновицкая область" },
  { name: "Кропивницкий", coords: [32.26, 48.51], oblast: "Кировоградская область" },
  { name: "Кривой Рог", coords: [33.39, 47.91], oblast: "Днепропетровская область" },
  { name: "Кременчуг", coords: [33.42, 49.07], oblast: "Полтавская область" },
  { name: "Херсон", coords: [32.62, 46.64], oblast: "Херсонская область" },
  { name: "Славянск", coords: [37.62, 48.85], oblast: "Донецкая область" },
  { name: "Краматорск", coords: [37.55, 48.72], oblast: "Донецкая область" },
  { name: "Павлоград", coords: [35.87, 48.53], oblast: "Днепропетровская область" },
  { name: "Никополь", coords: [34.4, 47.57], oblast: "Днепропетровская область" },
  { name: "Измаил", coords: [28.84, 45.35], oblast: "Одесская область" },
  { name: "Мариуполь", coords: [37.54, 47.1], oblast: "Донецкая область" },
  { name: "Бахмут", coords: [38.0, 48.59], oblast: "Донецкая область" },
  { name: "Авдеевка", coords: [37.75, 48.14], oblast: "Донецкая область" },
  { name: "Купянск", coords: [37.6, 49.71], oblast: "Харьковская область" },
  { name: "Изюм", coords: [37.25, 49.21], oblast: "Харьковская область" },
  { name: "Покровск", coords: [37.17, 48.28], oblast: "Донецкая область" },
  { name: "Херсонес/Севастополь", coords: [33.52, 44.6], oblast: "Крым (оккупирован)" },
];

interface KeyEventDef {
  date: string;
  type: EventType;
  title: string;
  description: string;
  coords: LngLat | null;
  placeName: string | null;
  confidence: Confidence;
}

/** Реальные ключевые события (подтверждённые, в пределах знаний генератора). */
export const KEY_EVENTS: KeyEventDef[] = [
  { date: "2022-02-24", type: "political", title: "Начало полномасштабного вторжения России в Украину", description: "Ракетные удары по всей территории Украины, начало наземного наступления с нескольких направлений.", coords: null, placeName: null, confidence: "confirmed" },
  { date: "2022-02-25", type: "combat", title: "Бои за аэропорт Гостомель", description: "Бои за аэродром Антонов под Киевом — попытка высадки десанта.", coords: [30.19, 50.6], placeName: "Гостомель", confidence: "confirmed" },
  { date: "2022-03-02", type: "front_change", title: "Оккупация Херсона", description: "Херсон стал первым областным центром, занятым российскими войсками.", coords: [32.62, 46.64], placeName: "Херсон", confidence: "confirmed" },
  { date: "2022-03-16", type: "airstrike", title: "Удар по драмтеатру Мариуполя", description: "Разрушен драматический театр, где укрывались мирные жители.", coords: [37.55, 47.096], placeName: "Мариуполь", confidence: "confirmed" },
  { date: "2022-04-03", type: "political", title: "Освобождение Бучи, обнаружены массовые убийства", description: "После отхода российских войск из Киевской области задокументированы военные преступления.", coords: [30.22, 50.55], placeName: "Буча", confidence: "confirmed" },
  { date: "2022-04-08", type: "missile_strike", title: "Ракетный удар по вокзалу Краматорска", description: "Удар по железнодорожному вокзалу во время эвакуации гражданских.", coords: [37.55, 48.72], placeName: "Краматорск", confidence: "confirmed" },
  { date: "2022-04-14", type: "combat", title: "Потоплен крейсер «Москва»", description: "Флагман Черноморского флота затонул после поражения ракетами «Нептун».", coords: [31.0, 45.2], placeName: "Чёрное море", confidence: "confirmed" },
  { date: "2022-05-20", type: "front_change", title: "Завершение обороны «Азовстали»", description: "Окончание осады Мариуполя; гарнизон покинул завод.", coords: [37.61, 47.1], placeName: "Мариуполь", confidence: "confirmed" },
  { date: "2022-06-23", type: "international", title: "Украина получила статус кандидата в ЕС", description: "Европейский совет предоставил Украине статус кандидата на вступление.", coords: null, placeName: null, confidence: "confirmed" },
  { date: "2022-07-03", type: "front_change", title: "Оставлен Лисичанск", description: "ВСУ отошли из Лисичанска — Луганская область почти полностью под оккупацией.", coords: [38.55, 48.92], placeName: "Лисичанск", confidence: "confirmed" },
  { date: "2022-07-22", type: "international", title: "Подписана «зерновая сделка»", description: "Соглашение о разблокировании экспорта украинского зерна через Чёрное море.", coords: null, placeName: null, confidence: "confirmed" },
  { date: "2022-09-10", type: "front_change", title: "Освобождён Изюм", description: "Харьковское контрнаступление: освобождены Изюм, Купянск, Балаклея.", coords: [37.25, 49.21], placeName: "Изюм", confidence: "confirmed" },
  { date: "2022-09-30", type: "political", title: "Объявлена аннексия четырёх областей", description: "Россия объявила об аннексии Донецкой, Луганской, Запорожской и Херсонской областей; не признано международным сообществом.", coords: null, placeName: null, confidence: "confirmed" },
  { date: "2022-10-08", type: "other", title: "Взрыв на Крымском мосту", description: "Повреждён автомобильный и железнодорожный переход через Керченский пролив.", coords: [36.62, 45.3], placeName: "Керченский пролив", confidence: "confirmed" },
  { date: "2022-10-10", type: "missile_strike", title: "Массированные удары по энергетике", description: "Начало кампании массированных ракетных ударов по энергетической инфраструктуре.", coords: [30.52, 50.45], placeName: "Киев", confidence: "confirmed" },
  { date: "2022-11-11", type: "front_change", title: "Освобождение Херсона", description: "ВСУ вошли в Херсон; российские войска отведены на левый берег Днепра.", coords: [32.62, 46.64], placeName: "Херсон", confidence: "confirmed" },
  { date: "2023-01-14", type: "missile_strike", title: "Удар по жилому дому в Днепре", description: "Ракета попала в многоэтажный жилой дом, десятки погибших.", coords: [35.05, 48.45], placeName: "Днепр", confidence: "confirmed" },
  { date: "2023-05-20", type: "front_change", title: "Падение Бахмута", description: "После почти года боёв город перешёл под российский контроль.", coords: [38.0, 48.59], placeName: "Бахмут", confidence: "confirmed" },
  { date: "2023-06-04", type: "combat", title: "Начало летнего контрнаступления ВСУ", description: "Начало наступательных действий на южном направлении.", coords: [35.8, 47.4], placeName: "Запорожская область", confidence: "confirmed" },
  { date: "2023-06-06", type: "other", title: "Разрушение Каховской ГЭС", description: "Подрыв плотины вызвал катастрофическое наводнение в низовьях Днепра.", coords: [33.37, 46.78], placeName: "Новая Каховка", confidence: "confirmed" },
  { date: "2023-06-24", type: "political", title: "Мятеж ЧВК «Вагнер»", description: "Вооружённый мятеж Пригожина: колонны двигались на Москву, мятеж прекращён в тот же день.", coords: null, placeName: null, confidence: "confirmed" },
  { date: "2024-02-17", type: "front_change", title: "Падение Авдеевки", description: "ВСУ отошли из Авдеевки после многомесячных боёв.", coords: [37.75, 48.14], placeName: "Авдеевка", confidence: "confirmed" },
  { date: "2024-08-06", type: "front_change", title: "Начало Курской операции ВСУ", description: "Начало трансграничной операции в Курской области РФ (на демо-карте не отображается).", coords: null, placeName: null, confidence: "confirmed" },
];

const COMBAT_TEMPLATES = [
  "Позиционные бои в районе {place}",
  "Штурмовые действия у {place}",
  "Артиллерийские дуэли на участке {place}",
  "Отражена атака в районе {place}",
  "Бои местного значения у {place}",
];
const MISSILE_TEMPLATES = [
  "Ракетный удар по объектам в {place}",
  "Ракетная атака: взрывы в {place}",
  "Удар крылатыми ракетами по инфраструктуре {place}",
];
const UAV_TEMPLATES = [
  "Атака ударных БПЛА на {place}",
  "Ночная атака дронов: работа ПВО над {place}",
  "БПЛА атаковали объекты энергетики в {place}",
];
const AIR_TEMPLATES = [
  "Авиаудар по позициям в районе {place}",
  "Удары управляемыми авиабомбами у {place}",
];
const POLITICAL_TEMPLATES: Array<[EventType, string]> = [
  ["sanctions", "Обсуждение нового пакета санкций против России"],
  ["international", "Переговоры о военной помощи Украине"],
  ["political", "Заявление официальных лиц о ходе боевых действий"],
  ["economic", "Оценка экономических последствий войны"],
  ["statement", "Брифинг военного командования об оперативной обстановке"],
  ["international", "Встреча контактной группы по обороне Украины"],
];

function nearestCity(p: LngLat): City | null {
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = Math.hypot(c.coords[0] - p[0], c.coords[1] - p[1]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD < 1.5 ? best : null;
}

function srcRefs(rnd: () => number, date: string) {
  const isw = sourceByCode.get("isw")!;
  const acled = sourceByCode.get("acled")!;
  const deepstate = sourceByCode.get("deepstate")!;
  const all = [
    {
      code: isw.code,
      name: isw.name,
      url: `${isw.url}/backgrounder/russian-offensive-campaign-assessment-${date}`,
      publishedAt: `${date}T21:00:00Z`,
    },
    {
      code: acled.code,
      name: acled.name,
      url: `${acled.url}/ukraine-conflict-monitor/`,
      publishedAt: null,
    },
    {
      code: deepstate.code,
      name: deepstate.name,
      url: `${deepstate.url}/#${date}`,
      publishedAt: null,
    },
  ];
  return rnd() < 0.4 ? [all[0]!, pick(rnd, all.slice(1))] : [pick(rnd, all)];
}

let nextId = 1;

/**
 * События одного дня: реальные ключевые + синтетический фон.
 * frontLine — интерполированная линия фронта дня (для геопривязки боёв).
 */
export function generateEventsForDay(
  date: string,
  frontLine: LngLat[],
  frontChanged: boolean,
): WarEvent[] {
  const rnd = mulberry32(hashString(`events:${date}`));
  const events: WarEvent[] = [];

  for (const k of KEY_EVENTS) {
    if (k.date !== date) continue;
    events.push({
      id: nextId++,
      date,
      timeUtc: null,
      type: k.type,
      title: k.title,
      description: k.description,
      coords: k.coords,
      placeName: k.placeName,
      confidence: k.confidence,
      isKeyEvent: true,
      sources: srcRefs(rnd, date),
    });
  }

  const intensity =
    dateToMs(date) < dateToMs("2022-12-31") ? randInt(rnd, 7, 14) : randInt(rnd, 5, 12);

  for (let i = 0; i < intensity; i++) {
    const roll = rnd();
    let type: EventType;
    let coords: LngLat | null = null;
    let placeName: string | null = null;
    let title: string;
    let description: string | null = null;

    if (roll < 0.42 && frontLine.length > 1) {
      type = "combat";
      const idx = Math.floor(rnd() * (frontLine.length - 1));
      const p = frontLine[idx]!;
      coords = [p[0] + (rnd() - 0.5) * 0.15, p[1] + (rnd() - 0.5) * 0.15];
      const city = nearestCity(coords);
      placeName = city ? city.name : "линия фронта";
      title = pick(rnd, COMBAT_TEMPLATES).replace("{place}", placeName);
      description = "Сводка боевых действий за сутки по данным открытых источников.";
    } else if (roll < 0.52) {
      type = "missile_strike";
      const city = pick(rnd, CITIES);
      coords = [city.coords[0] + (rnd() - 0.5) * 0.05, city.coords[1] + (rnd() - 0.5) * 0.05];
      placeName = city.name;
      title = pick(rnd, MISSILE_TEMPLATES).replace("{place}", city.name);
    } else if (roll < 0.66) {
      type = "uav_strike";
      const city = pick(rnd, CITIES);
      coords = [city.coords[0] + (rnd() - 0.5) * 0.08, city.coords[1] + (rnd() - 0.5) * 0.08];
      placeName = city.name;
      title = pick(rnd, UAV_TEMPLATES).replace("{place}", city.name);
    } else if (roll < 0.74 && frontLine.length > 1) {
      type = "airstrike";
      const idx = Math.floor(rnd() * (frontLine.length - 1));
      const p = frontLine[idx]!;
      coords = [p[0] + (rnd() - 0.5) * 0.2, p[1] + (rnd() - 0.5) * 0.2];
      const city = nearestCity(coords);
      placeName = city ? city.name : "прифронтовая зона";
      title = pick(rnd, AIR_TEMPLATES).replace("{place}", placeName);
    } else if (roll < 0.8 && frontChanged && frontLine.length > 1) {
      type = "front_change";
      const idx = Math.floor(rnd() * (frontLine.length - 1));
      coords = frontLine[idx]!;
      const city = nearestCity(coords);
      placeName = city ? city.name : "линия фронта";
      title = `Изменение линии фронта в районе ${placeName}`;
      description = "Зафиксировано изменение конфигурации фронта; подробности в слое изменений на карте.";
    } else {
      const [t, tpl] = pick(rnd, POLITICAL_TEMPLATES);
      type = t;
      title = tpl;
    }

    const hasTime = rnd() < 0.7;
    events.push({
      id: nextId++,
      date,
      timeUtc: hasTime
        ? `${String(randInt(rnd, 0, 23)).padStart(2, "0")}:${String(randInt(rnd, 0, 59)).padStart(2, "0")}`
        : null,
      type,
      title,
      description,
      coords,
      placeName,
      confidence:
        rnd() < 0.45 ? "confirmed" : rnd() < 0.75 ? "reported" : rnd() < 0.92 ? "claimed" : "disputed",
      isKeyEvent: false,
      sources: srcRefs(rnd, date),
    });
  }

  return events;
}
