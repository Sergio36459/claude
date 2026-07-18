"use client";

import { create } from "zustand";

export interface LayerToggles {
  control: boolean;
  frontline: boolean;
  diff: boolean;
  events: boolean;
}

/** Сравнение дат: линия фронта N месяцев назад «призраком» (0 = выкл). */
export type GhostMonths = 0 | 1 | 6 | 12;

interface UiState {
  theme: "light" | "dark";
  layers: LayerToggles;
  ghostMonths: GhostMonths;
  eventsPanelOpen: boolean;
  statsPanelOpen: boolean;
  searchOpen: boolean;
  hotkeysOpen: boolean;
  lossesSide: "ru" | "ua";
  toggleTheme: () => void;
  setTheme: (t: "light" | "dark") => void;
  toggleLayer: (k: keyof LayerToggles) => void;
  setGhostMonths: (m: GhostMonths) => void;
  toggleEventsPanel: () => void;
  toggleStatsPanel: () => void;
  setSearchOpen: (v: boolean) => void;
  setHotkeysOpen: (v: boolean) => void;
  setLossesSide: (s: "ru" | "ua") => void;
}

const PERSIST_KEY = "uwt-settings-v1";

function applyThemeClass(theme: "light" | "dark") {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: "dark",
  layers: { control: true, frontline: true, diff: true, events: true },
  ghostMonths: 0,
  eventsPanelOpen: true,
  statsPanelOpen: true,
  searchOpen: false,
  hotkeysOpen: false,
  lossesSide: "ru",
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  setTheme: (theme) => {
    applyThemeClass(theme);
    set({ theme });
  },
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setGhostMonths: (ghostMonths) => set({ ghostMonths }),
  toggleEventsPanel: () => set((s) => ({ eventsPanelOpen: !s.eventsPanelOpen })),
  toggleStatsPanel: () => set((s) => ({ statsPanelOpen: !s.statsPanelOpen })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setHotkeysOpen: (hotkeysOpen) => set({ hotkeysOpen }),
  setLossesSide: (lossesSide) => set({ lossesSide }),
}));

/** Гидратация сохранённых настроек ПОСЛЕ монтирования (без SSR-рассинхрона). */
export function hydrateUiStore(): void {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<
        Pick<UiState, "theme" | "layers" | "lossesSide">
      >;
      if (saved.theme) useUiStore.getState().setTheme(saved.theme);
      if (saved.layers) {
        useUiStore.setState((s) => ({ layers: { ...s.layers, ...saved.layers } }));
      }
      if (saved.lossesSide) useUiStore.setState({ lossesSide: saved.lossesSide });
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      useUiStore.getState().setTheme("light");
    } else {
      applyThemeClass(useUiStore.getState().theme);
    }
  } catch {
    /* повреждённый localStorage — работаем с дефолтами */
  }
  useUiStore.subscribe((s) => {
    try {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({ theme: s.theme, layers: s.layers, lossesSide: s.lossesSide }),
      );
    } catch {
      /* квота/приватный режим — настройки не сохраняются */
    }
  });
}
