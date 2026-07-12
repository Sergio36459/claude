"use client";

import Link from "next/link";
import { useState } from "react";
import { useUiStore, type LayerToggles } from "@/stores/uiStore";

const LAYER_LABELS: Record<keyof LayerToggles, string> = {
  control: "Зоны контроля",
  frontline: "Линия фронта",
  diff: "Изменения за день",
  events: "События",
};

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const layers = useUiStore((s) => s.layers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);
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
            className="panel-glass absolute right-0 top-full z-30 mt-1 w-48 rounded-lg p-2"
            role="menu"
          >
            {(Object.keys(LAYER_LABELS) as Array<keyof LayerToggles>).map((k) => (
              <label key={k} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />
                {LAYER_LABELS[k]}
              </label>
            ))}
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
