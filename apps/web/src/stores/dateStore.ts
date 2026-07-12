"use client";

import { create } from "zustand";
import { FIRST_DATE, addDays, addMonths, clampDate } from "@uwt/shared";
import type { PlaybackSpeed } from "@/lib/config";

interface DateState {
  date: string;
  lastDate: string; // из манифеста
  manifestLoaded: boolean;
  playing: boolean;
  speed: PlaybackSpeed;
  /** true во время перетаскивания ползунка — карта работает в грубом LOD без анимации */
  scrubbing: boolean;
  setDate: (d: string) => void;
  stepDays: (n: number) => void;
  stepMonths: (n: number) => void;
  stepYears: (n: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: PlaybackSpeed) => void;
  setScrubbing: (s: boolean) => void;
  setLastDate: (d: string) => void;
}

export const useDateStore = create<DateState>((set, get) => ({
  date: FIRST_DATE,
  lastDate: FIRST_DATE,
  manifestLoaded: false,
  playing: false,
  speed: 5,
  scrubbing: false,
  // до загрузки манифеста верхняя граница неизвестна — не зажимаем дату сверху
  setDate: (d) =>
    set({
      date: get().manifestLoaded
        ? clampDate(d, FIRST_DATE, get().lastDate)
        : clampDate(d, FIRST_DATE, "2099-12-31"),
    }),
  stepDays: (n) => get().setDate(addDays(get().date, n)),
  stepMonths: (n) => get().setDate(addMonths(get().date, n)),
  stepYears: (n) => get().setDate(addMonths(get().date, n * 12)),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setScrubbing: (scrubbing) => set({ scrubbing }),
  setLastDate: (lastDate) =>
    set((s) => ({
      lastDate,
      manifestLoaded: true,
      date: clampDate(s.date, FIRST_DATE, lastDate),
    })),
}));
