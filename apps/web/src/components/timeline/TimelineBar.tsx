"use client";

import { useMemo } from "react";
import { FIRST_DATE, addDays, daysBetween, isValidIsoDate } from "@uwt/shared";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "@/lib/config";
import { useKeyEvents } from "@/lib/data";
import { fmtDateLong } from "@/lib/format";
import { useDateStore } from "@/stores/dateStore";

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-white/10"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

export function TimelineBar() {
  const date = useDateStore((s) => s.date);
  const lastDate = useDateStore((s) => s.lastDate);
  const playing = useDateStore((s) => s.playing);
  const speed = useDateStore((s) => s.speed);
  const setDate = useDateStore((s) => s.setDate);
  const stepDays = useDateStore((s) => s.stepDays);
  const stepMonths = useDateStore((s) => s.stepMonths);
  const stepYears = useDateStore((s) => s.stepYears);
  const setPlaying = useDateStore((s) => s.setPlaying);
  const setSpeed = useDateStore((s) => s.setSpeed);
  const setScrubbing = useDateStore((s) => s.setScrubbing);

  const total = Math.max(1, daysBetween(FIRST_DATE, lastDate));
  const idx = daysBetween(FIRST_DATE, date);
  const { data: keyEvents } = useKeyEvents();

  const yearTicks = useMemo(() => {
    const ticks: Array<{ label: string; pct: number }> = [];
    const firstYear = Number(FIRST_DATE.slice(0, 4));
    const lastYear = Number(lastDate.slice(0, 4));
    for (let y = firstYear + 1; y <= lastYear; y++) {
      const d = `${y}-01-01`;
      ticks.push({ label: String(y), pct: (daysBetween(FIRST_DATE, d) / total) * 100 });
    }
    return ticks;
  }, [lastDate, total]);

  return (
    <div className="panel-glass rounded-xl px-4 py-3" role="group" aria-label="Временная шкала">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <IconButton label="−1 год (Alt+←)" onClick={() => stepYears(-1)}>
            «Г
          </IconButton>
          <IconButton label="−1 месяц (Shift+←)" onClick={() => stepMonths(-1)}>
            «М
          </IconButton>
          <IconButton label="−1 день (←)" onClick={() => stepDays(-1)}>
            ‹
          </IconButton>
          <button
            type="button"
            aria-label={playing ? "Пауза (пробел)" : "Воспроизвести (пробел)"}
            title={playing ? "Пауза (пробел)" : "Воспроизвести (пробел)"}
            onClick={() => setPlaying(!playing)}
            className="mx-1 flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "var(--series-canonical)" }}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <IconButton label="+1 день (→)" onClick={() => stepDays(1)}>
            ›
          </IconButton>
          <IconButton label="+1 месяц (Shift+→)" onClick={() => stepMonths(1)}>
            М»
          </IconButton>
          <IconButton label="+1 год (Alt+→)" onClick={() => stepYears(1)}>
            Г»
          </IconButton>
        </div>

        <select
          aria-label="Скорость воспроизведения"
          className="rounded-md border bg-transparent px-1.5 py-1 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value) as PlaybackSpeed)}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>

        <div className="min-w-40 text-sm font-semibold tnum" style={{ color: "var(--text-primary)" }}>
          {fmtDateLong(date)}
        </div>

        <input
          type="date"
          aria-label="Выбор даты"
          className="ml-auto rounded-md border bg-transparent px-2 py-1 text-sm tnum"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          min={FIRST_DATE}
          max={lastDate}
          value={date}
          onChange={(e) => {
            if (isValidIsoDate(e.target.value)) setDate(e.target.value);
          }}
        />
      </div>

      <div className="relative mt-3">
        {/* маркеры ключевых событий над треком */}
        <div className="pointer-events-none absolute -top-1.5 left-0 right-0 h-2">
          {keyEvents?.map((k) => (
            <button
              key={k.date}
              type="button"
              title={`${k.date}: ${k.title}`}
              onClick={() => setDate(k.date)}
              className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 rounded-full"
              style={{
                left: `${(daysBetween(FIRST_DATE, k.date) / total) * 100}%`,
                background: "var(--series-ua-gs)",
              }}
              aria-label={`Ключевое событие ${k.date}: ${k.title}`}
            />
          ))}
        </div>
        <input
          type="range"
          className="timeline-slider"
          min={0}
          max={total}
          value={idx}
          aria-label="Ползунок даты"
          aria-valuetext={fmtDateLong(date)}
          onPointerDown={() => setScrubbing(true)}
          onPointerUp={() => setScrubbing(false)}
          onChange={(e) => setDate(addDays(FIRST_DATE, Number(e.target.value)))}
        />
        <div className="relative mt-0.5 h-4 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="absolute left-0">2022</span>
          {yearTicks.map((t) => (
            <span key={t.label} className="absolute -translate-x-1/2" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
