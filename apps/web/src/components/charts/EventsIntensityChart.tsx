"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartFile } from "@uwt/shared";
import { fmtInt } from "@/lib/format";
import { useDateStore } from "@/stores/dateStore";
import { useChartTheme } from "./chartTheme";

/** Порядок стека фиксирован; всё вне пятёрки складывается в «прочее». */
const STACK_ORDER = ["combat", "missile_strike", "uav_strike", "airstrike", "front_change"];
const TYPE_LABEL: Record<string, string> = {
  combat: "бои",
  missile_strike: "ракетные удары",
  uav_strike: "атаки БПЛА",
  airstrike: "авиаудары",
  front_change: "изменения фронта",
  other: "прочее",
};

export function EventsIntensityChart({ file }: { file: ChartFile }) {
  const t = useChartTheme();
  const date = useDateStore((s) => s.date);
  const setDate = useDateStore((s) => s.setDate);

  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const s of file.series) {
      const type = s.id.replace("weekly:", "");
      const key = STACK_ORDER.includes(type) ? type : "other";
      for (const p of s.points) {
        const d = p[0] as string;
        const row = byDate.get(d) ?? { date: d };
        row[key] = ((row[key] as number) ?? 0) + (p[1] as number);
        byDate.set(d, row);
      }
    }
    return [...byDate.values()].sort((a, b) => ((a.date as string) < (b.date as string) ? -1 : 1));
  }, [file]);

  const refDate = useMemo(() => {
    let best: string | null = null;
    for (const r of rows) {
      if ((r.date as string) <= date) best = r.date as string;
      else break;
    }
    return best;
  }, [rows, date]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={rows}
        margin={{ top: 8, right: 12, bottom: 4, left: 8 }}
        onClick={(e) => {
          const label = (e as { activeLabel?: string })?.activeLabel;
          if (label) setDate(label);
        }}
      >
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => `${d.slice(5, 7)}.${d.slice(2, 4)}`}
          tick={{ fill: t.muted, fontSize: 11 }}
          stroke={t.axis}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v: number) => fmtInt(v)}
          tick={{ fill: t.muted, fontSize: 11 }}
          stroke="transparent"
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: t.grid, fillOpacity: 0.4 }}
          contentStyle={{
            background: t.surface,
            border: `1px solid ${t.grid}`,
            borderRadius: 8,
            fontSize: 12,
            color: t.ink,
          }}
          labelStyle={{ color: t.muted }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: t.ink }} />
        {refDate && <ReferenceLine x={refDate} stroke={t.muted} strokeDasharray="4 3" />}
        {[...STACK_ORDER, "other"].map((type) => (
          <Bar
            key={type}
            dataKey={type}
            name={TYPE_LABEL[type]}
            stackId="week"
            fill={t.byEventType[type] ?? t.muted}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
