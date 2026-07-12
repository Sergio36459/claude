"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/uiStore";

/** Роли палитры → конкретные hex (SVG-атрибуты recharts не понимают var()). */
export interface ChartTheme {
  grid: string;
  axis: string;
  ink: string;
  muted: string;
  surface: string;
  bySource: Record<string, string>;
  byEventType: Record<string, string>;
}

const VAR_SOURCE: Record<string, string> = {
  deepstate: "--series-canonical",
  isw: "--series-canonical",
  oryx: "--series-oryx",
  ua_general_staff: "--series-ua-gs",
  western_estimates: "--series-western",
  ru_mod: "--series-ru-mod",
  bbc_mediazona: "--series-mediazona",
  ualosses: "--series-ualosses",
};

/** Цвет закреплён за типом события и совпадает с точками на карте. */
const EVENT_TYPE_HEX: Record<string, string> = {
  combat: "#e34948",
  front_change: "#2a78d6",
  missile_strike: "#eda100",
  uav_strike: "#eb6834",
  airstrike: "#e87ba4",
  other: "#898781",
};

export function useChartTheme(): ChartTheme {
  const theme = useUiStore((s) => s.theme);
  const [t, setT] = useState<ChartTheme>(() => ({
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    ink: "#0b0b0b",
    muted: "#898781",
    surface: "#fcfcfb",
    bySource: {},
    byEventType: EVENT_TYPE_HEX,
  }));

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const bySource: Record<string, string> = {};
    for (const [code, cssVar] of Object.entries(VAR_SOURCE)) bySource[code] = v(cssVar);
    setT({
      grid: v("--grid"),
      axis: v("--baseline"),
      ink: v("--text-primary"),
      muted: v("--text-muted"),
      surface: v("--surface-1"),
      bySource,
      byEventType: EVENT_TYPE_HEX,
    });
  }, [theme]);

  return t;
}
