"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartFile, ChartSeries } from "@uwt/shared";
import { fmtInt } from "@/lib/format";
import { useDateStore } from "@/stores/dateStore";
import { useChartTheme } from "./chartTheme";

interface Props {
  file: ChartFile;
  filter?: (s: ChartSeries) => boolean;
  colorFor: (s: ChartSeries) => string;
}

type Row = Record<string, unknown> & { date: string };

/** Универсальный график временных рядов: линии + диапазоны min–max (Area). */
export function TimeSeriesChart({ file, filter, colorFor }: Props) {
  const t = useChartTheme();
  const date = useDateStore((s) => s.date);
  const setDate = useDateStore((s) => s.setDate);

  const series = useMemo(
    () => file.series.filter((s) => (filter ? filter(s) : true)),
    [file, filter],
  );

  const rows = useMemo<Row[]>(() => {
    const byDate = new Map<string, Row>();
    for (const s of series) {
      for (const p of s.points) {
        const d = p[0] as string;
        const row = byDate.get(d) ?? { date: d };
        if (p.length >= 3) {
          row[s.id] = ((p[1] as number) + (p[2] as number)) / 2;
          row[`${s.id}__range`] = [p[1], p[2]];
        } else {
          row[s.id] = p[1];
        }
        byDate.set(d, row);
      }
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [series]);

  const refDate = useMemo(() => {
    let best: string | null = null;
    for (const r of rows) {
      if (r.date <= date) best = r.date;
      else break;
    }
    return best;
  }, [rows, date]);

  const tickFmt = (d: string) => `${d.slice(5, 7)}.${d.slice(2, 4)}`;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={rows}
        margin={{ top: 8, right: 12, bottom: 4, left: 8 }}
        onClick={(e) => {
          const label = (e as { activeLabel?: string })?.activeLabel;
          if (label) setDate(label);
        }}
      >
        <XAxis
          dataKey="date"
          tickFormatter={tickFmt}
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
          width={64}
        />
        <Tooltip
          contentStyle={{
            background: t.surface,
            border: `1px solid ${t.grid}`,
            borderRadius: 8,
            fontSize: 12,
            color: t.ink,
          }}
          labelStyle={{ color: t.muted }}
          formatter={(value: number | number[], name: string) => {
            if (Array.isArray(value))
              return [`${fmtInt(value[0]!)}–${fmtInt(value[1]!)} ${file.unit}`, name];
            return [`${fmtInt(value)} ${file.unit}`, name];
          }}
        />
        {series.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 12, color: t.ink }}
            iconType="plainline"
            content={({ payload }) => (
              <ul className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs">
                {(payload ?? [])
                  .filter((p) => !String(p.dataKey).endsWith("__range"))
                  .map((p) => (
                    <li key={String(p.dataKey)} style={{ color: t.ink }}>
                      <span style={{ color: p.color }}>—</span> {p.value}
                    </li>
                  ))}
              </ul>
            )}
          />
        )}
        {refDate && <ReferenceLine x={refDate} stroke={t.muted} strokeDasharray="4 3" />}
        {series.map((s) =>
          s.points.some((p) => p.length >= 3) ? (
            <Area
              key={`${s.id}__range`}
              dataKey={`${s.id}__range`}
              name={s.label}
              stroke="none"
              fill={colorFor(s)}
              fillOpacity={0.18}
              legendType="none"
              tooltipType="none"
              isAnimationActive={false}
            />
          ) : null,
        )}
        {series.map((s) => (
          <Line
            key={s.id}
            dataKey={s.id}
            name={s.label}
            stroke={colorFor(s)}
            strokeWidth={2}
            // второй ряд того же источника (захвачено/заявлено) — пунктиром,
            // чтобы идентичность источника оставалась за цветом
            strokeDasharray={
              s.id.includes(":captured") || s.id.includes(":total_claimed") ? "6 4" : undefined
            }
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
