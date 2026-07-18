/**
 * ДЕМО-датасет: синтетическая геометрия (кейфреймы), синтетические потери
 * и события. Быстрый, полностью офлайн. Для реальных данных — generate-real.ts.
 *
 * Запуск: pnpm gen:demo
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { FIRST_DATE } from "@uwt/shared";
import { approxGeometryProvider, buildDataset } from "./dataset";
import { demoEventsProvider, demoLossesProvider } from "./providers/demo";

const LAST_DATE = process.env.UWT_LAST_DATE ?? "2025-12-31";
const OUT_DIR =
  process.env.UWT_DATA_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/public/data");

buildDataset({
  outDir: OUT_DIR,
  firstDate: FIRST_DATE,
  lastDate: LAST_DATE,
  demo: true,
  coverage: { geometry: "synthetic", losses: "synthetic", events: "synthetic" },
  geometry: approxGeometryProvider("approx"),
  losses: demoLossesProvider(),
  events: demoEventsProvider(),
});
