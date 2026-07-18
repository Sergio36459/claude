"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, daysBetween } from "@uwt/shared";
import { prefetchDay } from "@/lib/data";
import { useDateStore } from "@/stores/dateStore";

/**
 * Двигатель автовоспроизведения: 1x = 1 день/сек, до 60x.
 * Скользящее окно предзагрузки + грубый LOD на высоких скоростях (docs/05 §4).
 */
export function usePlayback(): void {
  const playing = useDateStore((s) => s.playing);
  const speed = useDateStore((s) => s.speed);
  const qc = useQueryClient();

  useEffect(() => {
    if (!playing) return;
    const tickMs = Math.max(40, 1000 / speed);
    const daysPerTick = Math.max(1, Math.round((speed * tickMs) / 1000));
    const lod: 0 | 1 = speed >= 2 ? 0 : 1;

    const id = setInterval(() => {
      const { date, lastDate, setDate, setPlaying } = useDateStore.getState();
      if (daysBetween(date, lastDate) <= 0) {
        setPlaying(false);
        return;
      }
      const next = addDays(date, daysPerTick);
      setDate(next);
      const ahead = Math.min(Math.ceil(speed * 2), 30);
      for (let i = 1; i <= ahead; i += daysPerTick) {
        const d = addDays(next, i);
        if (daysBetween(d, lastDate) < 0) break;
        prefetchDay(qc, d, lod);
      }
    }, tickMs);
    return () => clearInterval(id);
  }, [playing, speed, qc]);
}
