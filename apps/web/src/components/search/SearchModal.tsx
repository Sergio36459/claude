"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isValidIsoDate } from "@uwt/shared";
import { useKeyEvents, usePlaces } from "@/lib/data";
import { MONTHS_RU_NOMINATIVE } from "@/lib/format";
import { mapBus } from "@/lib/mapController";
import { useDateStore } from "@/stores/dateStore";
import { useUiStore } from "@/stores/uiStore";

interface Result {
  key: string;
  group: "Места" | "Ключевые события" | "Дата";
  label: string;
  sublabel?: string;
  run: () => void;
}

/** Разбор дат: 2023-06-06, 06.06.2023, «июнь 2023». */
function parseDateQuery(q: string): string | null {
  const s = q.trim().toLowerCase();
  if (isValidIsoDate(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  const my = s.match(/^([а-яё]+)\s+(\d{4})$/);
  if (my) {
    const idx = MONTHS_RU_NOMINATIVE.findIndex((name) => name.startsWith(my[1]!.slice(0, 3)));
    if (idx >= 0) return `${my[2]}-${String(idx + 1).padStart(2, "0")}-01`;
  }
  return null;
}

export function SearchModal() {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const setDate = useDateStore((s) => s.setDate);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: places } = usePlaces();
  const { data: keyEvents } = useKeyEvents();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];
    const dateHit = parseDateQuery(q);
    if (dateHit) {
      out.push({
        key: `date:${dateHit}`,
        group: "Дата",
        label: `Перейти к ${dateHit}`,
        run: () => setDate(dateHit),
      });
    }
    if (q.length >= 2) {
      for (const p of places ?? []) {
        if (p.name.toLowerCase().includes(q)) {
          out.push({
            key: `place:${p.name}`,
            group: "Места",
            label: p.name,
            sublabel: "город",
            run: () => mapBus.flyTo?.(p.coords, p.zoom ?? 9),
          });
        }
        if (out.length > 14) break;
      }
      for (const k of keyEvents ?? []) {
        if (k.title.toLowerCase().includes(q)) {
          out.push({
            key: `kev:${k.date}`,
            group: "Ключевые события",
            label: k.title,
            sublabel: k.date,
            run: () => setDate(k.date),
          });
        }
        if (out.length > 20) break;
      }
    }
    return out.slice(0, 20);
  }, [query, places, keyEvents, setDate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Поиск"
    >
      <div
        className="panel-glass w-full max-w-lg rounded-xl p-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && results[selected]) {
              results[selected]!.run();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Город, событие или дата (06.06.2023, «июнь 2023»)…"
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <div className="mt-1 max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                r.run();
                setOpen(false);
              }}
              onMouseEnter={() => setSelected(i)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm"
              style={{
                background: i === selected ? "var(--grid)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              <span>
                <span className="mr-2 text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                  {r.group}
                </span>
                {r.label}
              </span>
              {r.sublabel && (
                <span className="text-xs tnum" style={{ color: "var(--text-muted)" }}>
                  {r.sublabel}
                </span>
              )}
            </button>
          ))}
          {query.length >= 2 && results.length === 0 && (
            <p className="px-3 py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Ничего не найдено
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
