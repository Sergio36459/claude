/**
 * РЕАЛЬНЫЙ датасет:
 *  - потери: Генштаб ВСУ (зеркало russianwarship.rip), ежедневно по сегодня;
 *  - геометрия: DeepState API (полная история); если сеть до DeepState
 *    закрыта — кейфрейм-приближение с пометкой coverage.geometry='approximate';
 *  - события: только реальные ключевые (синтетический фон отключён).
 *
 * Запуск: pnpm gen:real
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { FIRST_DATE } from "@uwt/shared";
import { approxGeometryProvider, buildDataset } from "./dataset";
import { keyEventsOnlyProvider } from "./providers/demo";
import { tryLoadDeepstate } from "./providers/deepstate";
import { loadGenstaffLosses } from "./providers/genstaff";
import { tryLoadOwlmaps } from "./providers/owlmaps";

const OUT_DIR =
  process.env.UWT_DATA_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/public/data");
const CACHE_DIR =
  process.env.UWT_CACHE_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.cache/deepstate");

async function main(): Promise<void> {
  const losses = await loadGenstaffLosses();
  const lastDate = process.env.UWT_LAST_DATE ?? losses.lastDate;

  // цепочка реальных источников геометрии: DeepState → UA Control Map → приближение
  const real =
    (await tryLoadDeepstate(FIRST_DATE, lastDate, CACHE_DIR)) ??
    (await tryLoadOwlmaps(
      FIRST_DATE,
      lastDate,
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.cache/owlmaps"),
    ));
  const geometry = real ?? approxGeometryProvider("approx");

  buildDataset({
    outDir: OUT_DIR,
    firstDate: FIRST_DATE,
    lastDate: real ? real.lastDate : lastDate,
    demo: false,
    coverage: {
      geometry: real ? real.sourceCode : "approximate",
      losses: "ua_general_staff",
      events: "key-only",
    },
    geometry,
    losses,
    events: keyEventsOnlyProvider(),
  });
}

void main();
