"use client";

import Link from "next/link";
import { useManifest } from "@/lib/data";

/** Датасет демонстрационный — обязательная плашка, пока ETL не подключён к реальным источникам. */
export function DemoBanner() {
  const { data } = useManifest();
  if (!data?.demo) return null;
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
