const nf = new Intl.NumberFormat("ru-RU");

export function fmtInt(n: number): string {
  return nf.format(Math.round(n));
}

export function fmtSigned(n: number): string {
  const s = nf.format(Math.abs(Math.round(n * 10) / 10));
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : "0";
}

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const MONTHS_RU_NOMINATIVE = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

export function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_RU[(m ?? 1) - 1]} ${y}`;
}

export function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${String(y).slice(2)}`;
}
