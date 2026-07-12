"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChartSeries } from "@uwt/shared";
import { EventsIntensityChart } from "@/components/charts/EventsIntensityChart";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { useChartTheme } from "@/components/charts/chartTheme";
import { DemoBanner } from "@/components/DemoBanner";
import { SearchModal } from "@/components/search/SearchModal";
import { useSeries } from "@/lib/data";
import { fmtDateLong } from "@/lib/format";
import { useDateStore } from "@/stores/dateStore";

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {sub && (
        <p className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
      {children}
    </section>
  );
}

function SideToggle({
  side,
  setSide,
}: {
  side: "ru" | "ua";
  setSide: (s: "ru" | "ua") => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border text-xs"
      style={{ borderColor: "var(--border)" }}
    >
      {(["ru", "ua"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={side === v}
          onClick={() => setSide(v)}
          className="px-2.5 py-1"
          style={{
            background: side === v ? "var(--series-canonical)" : "transparent",
            color: side === v ? "#fff" : "var(--text-secondary)",
          }}
        >
          {v === "ru" ? "потери РФ" : "потери Украины"}
        </button>
      ))}
    </div>
  );
}

const EQUIPMENT_CATS: Array<[string, string]> = [
  ["tank", "Танки"],
  ["ifv", "БМП"],
  ["artillery", "Артиллерия"],
  ["air_defense", "ПВО"],
  ["aircraft", "Самолёты"],
  ["helicopter", "Вертолёты"],
  ["uav", "БПЛА"],
  ["ship", "Корабли"],
];

export default function StatsPage() {
  const t = useChartTheme();
  const date = useDateStore((s) => s.date);
  const controlArea = useSeries("control-area");
  const frontLen = useSeries("frontline-length");
  const personnel = useSeries("losses-personnel");
  const equipment = useSeries("losses-equipment");
  const intensity = useSeries("events-intensity");

  const [personnelSide, setPersonnelSide] = useState<"ru" | "ua">("ru");
  const [equipSide, setEquipSide] = useState<"ru" | "ua">("ru");
  const [equipCat, setEquipCat] = useState("tank");

  const colorFor = (s: ChartSeries) =>
    (s.sourceCode && t.bySource[s.sourceCode]) || t.bySource["deepstate"] || "#2a78d6";

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm" style={{ color: "var(--series-canonical)" }}>
          ← Карта
        </Link>
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Графики динамики
        </h1>
        <span className="text-sm tnum" style={{ color: "var(--text-muted)" }}>
          выбранная дата: {fmtDateLong(date)} (клик по графику меняет дату)
        </span>
        <div className="ml-auto">
          <DemoBanner />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Площадь под контролем РФ"
          sub="км², включая территории, оккупированные с 2014 года"
        >
          {controlArea.data && <TimeSeriesChart file={controlArea.data} colorFor={colorFor} />}
        </ChartCard>

        <ChartCard title="Длина линии фронта" sub="км">
          {frontLen.data && <TimeSeriesChart file={frontLen.data} colorFor={colorFor} />}
        </ChartCard>

        <ChartCard
          title="Потери личного состава (накопленные)"
          sub="Каждая линия — отдельный источник; оценки не объединяются. Полоса — диапазон min–max."
        >
          <SideToggle side={personnelSide} setSide={setPersonnelSide} />
          {personnel.data && (
            <TimeSeriesChart
              file={personnel.data}
              filter={(s) => s.side === personnelSide}
              colorFor={colorFor}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Потери техники (накопленные)"
          sub="Линии — источники (Oryx: визуально подтверждённые; официальные заявления — отдельно)"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SideToggle side={equipSide} setSide={setEquipSide} />
            <select
              aria-label="Категория техники"
              className="rounded-md border bg-transparent px-1.5 py-1 text-xs"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              value={equipCat}
              onChange={(e) => setEquipCat(e.target.value)}
            >
              {EQUIPMENT_CATS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {equipment.data && (
            <TimeSeriesChart
              file={equipment.data}
              filter={(s) => s.side === equipSide && s.id.includes(`:${equipCat}:`)}
              colorFor={colorFor}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Интенсивность событий"
          sub="событий в неделю по типам (демо-датасет)"
        >
          {intensity.data && <EventsIntensityChart file={intensity.data} />}
        </ChartCard>
      </div>
      <SearchModal />
    </main>
  );
}
