"use client";

import Link from "next/link";
import { useManifest } from "@/lib/data";

/** Плашка происхождения данных: демо / смешанный режим (реальные потери + приближённая геометрия). */
export function DemoBanner() {
  const { data } = useManifest();
  if (!data) return null;

  if (data.demo) {
    return (
      <Link
        href="/methodology"
        className="pointer-events-auto rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-black shadow"
        title="Открыть методологию"
      >
        ДЕМО-ДАННЫЕ — синтетическое приближение, не для цитирования
      </Link>
    );
  }

  const geometryApprox = data.coverage?.geometry === "approximate";
  if (geometryApprox) {
    return (
      <Link
        href="/methodology"
        className="pointer-events-auto rounded-md bg-amber-500/80 px-2.5 py-1 text-xs font-medium text-black shadow"
        title="Открыть методологию"
      >
        Потери — реальные (Генштаб ВСУ) · геометрия фронта — приближение (для точной запустите
        импорт DeepState)
      </Link>
    );
  }

  const geoLabel =
    data.coverage?.geometry === "owlmaps" ? "UA Control Map" : "DeepState";
  return (
    <Link
      href="/methodology"
      className="pointer-events-auto rounded-md px-2.5 py-1 text-xs shadow panel-glass"
      style={{ color: "var(--text-secondary)" }}
      title="Открыть методологию"
    >
      Данные: {geoLabel} · Генштаб ВСУ
    </Link>
  );
}
