"use client";

import Link from "next/link";
import { useState } from "react";
import { useUiStore, type GhostMonths, type LayerToggles } from "@/stores/uiStore";

/** Строка = переключатель слоя + образец легенды (легенда объединена со «Слоями»). */
const LAYER_META: Record<keyof LayerToggles, { label: string; swatch: React.ReactNode }> = {
  control: {
    label: "Зоны контроля",
    swatch: (
      <span className="flex gap-0.5">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: "var(--map-ru-fill)", opacity: 0.45 }}
          title="под контролем РФ"
        />
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: "var(--map-gain-ua)", opacity: 0.45 }}
          title="занято ВСУ (терр. РФ)"
        />
      </span>
    ),
  },
  frontline: {
    label: "Линия фронта",
    swatch: (
      <span
        className="my-1.5 inline-block h-0.5 w-6 rounded"
        style={{ background: "var(--map-ru-line)" }}
      />
    ),
  },
  diff: {
    label: "Изменения за день",
    swatch: (
      <span className="flex gap-0.5">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: "var(--map-gain-ru)", opacity: 0.7 }}
          title="занято"
        />
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: "var(--map-gain-ua)", opacity: 0.7 }}
          title="освобождено"
        />
      </span>
    ),
  },
  events: {
    label: "События",
    swatch: (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: "#eda100" }}
      />
    ),
  },
};

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const layers = useUiStore((s) => s.layers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);
  const ghostMonths = useUiStore((s) => s.ghostMonths);
  const setGhostMonths = useUiStore((s) => s.setGhostMonths);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setHotkeysOpen = useUiStore((s) => s.setHotkeysOpen);
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <header className="panel-glass pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2">
      <Link href="/" className="mr-1 flex items-baseline gap-1.5">
        <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          UWT
        </span>
        <span className="hidden text-xs sm:inline" style={{ color: "var(--text-muted)" }}>
          хронология войны в Украине
        </span>
      </Link>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        🔍 <span className="hidden md:inline">Поиск…</span>
        <kbd className="hidden rounded border px-1 text-[10px] md:inline" style={{ borderColor: "var(--border)" }}>
          Ctrl K
        </kbd>
      </button>

      <div className="relative ml-auto">
        <button
          type="button"
          aria-expanded={layersOpen}
          onClick={() => setLayersOpen((v) => !v)}
          className="rounded-lg border px-2.5 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Слои ▾
        </button>
        {layersOpen && (
          <div
            className="panel-glass absolute right-0 top-full z-30 mt-1 w-64 rounded-lg p-2"
            role="menu"
          >
            {(Object.keys(LAYER_META) as Array<keyof LayerToggles>).map((k) => (
              <label
                key={k}
                className="flex items-center gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />
                {LAYER_META[k].swatch}
                {LAYER_META[k].label}
              </label>
            ))}
            <div
              className="mt-1 flex items-center gap-2 border-t px-1.5 pt-2 text-sm"
              style={{ borderColor: "var(--grid)", color: "var(--text-secondary)" }}
            >
              <span
                className="inline-block w-6 border-t-2 border-dashed"
                style={{ borderColor: "var(--text-muted)" }}
              />
              <label className="flex flex-1 items-center justify-between gap-2">
                Фронт в прошлом
                <select
                  aria-label="Призрак линии фронта"
                  className="rounded-md border bg-transparent px-1 py-0.5 text-xs"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  value={ghostMonths}
                  onChange={(e) => setGhostMonths(Number(e.target.value) as GhostMonths)}
                >
                  <option value={0}>выкл</option>
                  <option value={1}>−1 мес</option>
                  <option value={6}>−6 мес</option>
                  <option value={12}>−1 год</option>
                </select>
              </label>
            </div>
            <p className="px-1.5 pt-1 text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
              Красное — под контролем РФ, синее — занято ВСУ; изменения за день: красная
              пульсация — занято, синяя — освобождено. Пунктир — линия фронта выбранной
              давности.
            </p>
          </div>
        )}
      </div>

      <Link
        href="/stats"
        className="rounded-lg border px-2.5 py-1.5 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        Графики
      </Link>
      <Link
        href="/methodology"
        className="hidden rounded-lg border px-2.5 py-1.5 text-sm sm:block"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        Методология
      </Link>
      <button
        type="button"
        onClick={() => setHotkeysOpen(true)}
        title="Горячие клавиши (?)"
        aria-label="Горячие клавиши"
        className="hidden rounded-lg border px-2.5 py-1.5 text-sm sm:block"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        ⌨
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        title="Переключить тему (T)"
        aria-label="Переключить тему"
        className="rounded-lg border px-2.5 py-1.5 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>
    </header>
  );
}
