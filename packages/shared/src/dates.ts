import { FIRST_DATE } from "./contracts";

const MS_PER_DAY = 86_400_000;

/** Дата -> UTC-полночь в мс. Все даты проекта — календарные дни (ISO). */
export function dateToMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return msToDate(dateToMs(iso) + days * MS_PER_DAY);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(dateToMs(iso));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const maxDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, maxDay));
  return msToDate(d.getTime());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dateToMs(b) - dateToMs(a)) / MS_PER_DAY);
}

export function clampDate(iso: string, min: string, max: string): string {
  if (dateToMs(iso) < dateToMs(min)) return min;
  if (dateToMs(iso) > dateToMs(max)) return max;
  return iso;
}

/** Порядковый день войны (24.02.2022 = 1). */
export function warDayNumber(iso: string): number {
  return daysBetween(FIRST_DATE, iso) + 1;
}

export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateToMs(s));
}

export function* eachDay(from: string, to: string): Generator<string> {
  for (let ms = dateToMs(from); ms <= dateToMs(to); ms += MS_PER_DAY) {
    yield msToDate(ms);
  }
}
