"use client";

import { useEffect } from "react";
import { FIRST_DATE } from "@uwt/shared";
import { PLAYBACK_SPEEDS } from "@/lib/config";
import { useDateStore } from "@/stores/dateStore";
import { useUiStore } from "@/stores/uiStore";

/** Горячие клавиши по спецификации docs/07 §5. */
export function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUiStore.getState().setSearchOpen(true);
        return;
      }
      if (inField) return;

      const ds = useDateStore.getState();
      const ui = useUiStore.getState();
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          if (e.altKey) ds.stepYears(dir);
          else if (e.shiftKey) ds.stepMonths(dir);
          else ds.stepDays(dir);
          break;
        }
        case " ":
          e.preventDefault();
          ds.setPlaying(!ds.playing);
          break;
        case "+":
        case "=": {
          const i = PLAYBACK_SPEEDS.indexOf(ds.speed);
          ds.setSpeed(PLAYBACK_SPEEDS[Math.min(i + 1, PLAYBACK_SPEEDS.length - 1)]!);
          break;
        }
        case "-": {
          const i = PLAYBACK_SPEEDS.indexOf(ds.speed);
          ds.setSpeed(PLAYBACK_SPEEDS[Math.max(i - 1, 0)]!);
          break;
        }
        case "Home":
          ds.setDate(FIRST_DATE);
          break;
        case "End":
          ds.setDate(ds.lastDate);
          break;
        case "t":
        case "е": // ru-раскладка
          ui.toggleTheme();
          break;
        case "e":
        case "у":
          ui.toggleEventsPanel();
          break;
        case "s":
        case "ы":
        case "і":
          ui.toggleStatsPanel();
          break;
        case "/":
        case "k":
          e.preventDefault();
          ui.setSearchOpen(true);
          break;
        case "?":
          ui.setHotkeysOpen(!ui.hotkeysOpen);
          break;
        case "Escape":
          ui.setSearchOpen(false);
          ui.setHotkeysOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
