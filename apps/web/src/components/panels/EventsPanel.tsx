"use client";

import { useMemo, useState } from "react";
import type { Confidence, EventType, WarEvent } from "@uwt/shared";
import { useDayBundle } from "@/lib/data";
import { mapBus } from "@/lib/mapController";
import { useDateStore } from "@/stores/dateStore";

const TYPE_META: Record<EventType, { icon: string; label: string }> = {
  front_change: { icon: "🗺️", label: "Фронт" },
  combat: { icon: "⚔️", label: "Бои" },
  missile_strike: { icon: "🚀", label: "Ракеты" },
  uav_strike: { icon: "🛩️", label: "БПЛА" },
  airstrike: { icon: "✈️", label: "Авиация" },
  international: { icon: "🌍", label: "Международное" },
  political: { icon: "🏛️", label: "Политика" },
  economic: { icon: "💰", label: "Экономика" },
  sanctions: { icon: "📜", label: "Санкции" },
  statement: { icon: "🗣️", label: "Заявления" },
  other: { icon: "📌", label: "Другое" },
};

const CONF_META: Record<Confidence, { label: string; cls: string }> = {
  confirmed: { label: "подтверждено", cls: "border-transparent bg-emerald-600/15 text-emerald-700 dark:text-emerald-400" },
  reported: { label: "сообщается", cls: "border-current/40 text-sky-700 dark:text-sky-400" },
  claimed: { label: "заявлено", cls: "border-dashed border-current/40 text-amber-700 dark:text-amber-400" },
  disputed: { label: "оспаривается", cls: "border-current/40 text-red-700 dark:text-red-400" },
};

const FILTER_GROUPS: Array<{ label: string; types: EventType[] }> = [
  { label: "Бои", types: ["combat", "front_change", "airstrike"] },
  { label: "Удары", types: ["missile_strike", "uav_strike"] },
  { label: "Политика", types: ["international", "political", "economic", "sanctions", "statement", "other"] },
];

function EventCard({ event }: { event: WarEvent }) {
  const meta = TYPE_META[event.type];
  const conf = CONF_META[event.confidence];
  return (
    <article
      className={`rounded-lg border p-2.5 text-sm ${event.isKeyEvent ? "border-amber-500/50" : ""}`}
      style={{ borderColor: event.isKeyEvent ? undefined : "var(--border)", background: "var(--surface-1)" }}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => event.coords && mapBus.flyTo?.(event.coords, 8.5)}
        disabled={!event.coords}
        title={event.coords ? "Показать на карте" : undefined}
      >
        <span aria-hidden className="mt-0.5">{meta.icon}</span>
        <span className="flex-1">
          <span className="block font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
            {event.isKeyEvent && <span aria-label="ключевое событие">★ </span>}
            {event.title}
          </span>
          {event.description && (
            <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
              {event.description}
            </span>
          )}
        </span>
      </button>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {event.timeUtc && <span className="tnum">{event.timeUtc} UTC</span>}
        {event.placeName && <span>{event.placeName}</span>}
        <span className={`rounded border px-1 py-px ${conf.cls}`}>{conf.label}</span>
        <span className="ml-auto flex gap-1.5">
          {event.sources.map((s) => (
            <a
              key={s.code + s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:opacity-80"
              title={`Источник: ${s.name}`}
            >
              {s.name}
            </a>
          ))}
        </span>
      </div>
    </article>
  );
}

export function EventsPanel() {
  const date = useDateStore((s) => s.date);
  const { data: bundle, isLoading } = useDayBundle(date);
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());
  const [geoOnly, setGeoOnly] = useState(false);

  const events = useMemo(() => {
    if (!bundle) return [];
    const allowed =
      activeGroups.size === 0
        ? null
        : new Set(FILTER_GROUPS.filter((g) => activeGroups.has(g.label)).flatMap((g) => g.types));
    return bundle.events
      .filter((e) => (allowed ? allowed.has(e.type) : true))
      .filter((e) => (geoOnly ? !!e.coords : true))
      .sort((a, b) => Number(b.isKeyEvent) - Number(a.isKeyEvent) || a.id - b.id);
  }, [bundle, activeGroups, geoOnly]);

  return (
    <section className="flex h-full flex-col" aria-label="События дня">
      <header className="flex items-center justify-between px-3 pt-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          События дня {bundle ? `(${events.length})` : ""}
        </h2>
      </header>
      <div className="flex flex-wrap gap-1 px-3 py-2">
        {FILTER_GROUPS.map((g) => {
          const active = activeGroups.has(g.label);
          return (
            <button
              key={g.label}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setActiveGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.label)) next.delete(g.label);
                  else next.add(g.label);
                  return next;
                })
              }
              className={`rounded-full border px-2 py-0.5 text-xs ${active ? "text-white" : ""}`}
              style={{
                borderColor: "var(--border)",
                background: active ? "var(--series-canonical)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
              }}
            >
              {g.label}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={geoOnly} onChange={(e) => setGeoOnly(e.target.checked)} />
          на карте
        </label>
      </div>
      {/* Список дня ≤ ~40 элементов; при переходе на реальные данные с сотнями
          событий здесь включается @tanstack/react-virtual (docs/07). */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {isLoading && (
          <div className="space-y-2" aria-hidden>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg" style={{ background: "var(--grid)" }} />
            ))}
          </div>
        )}
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
        {!isLoading && events.length === 0 && (
          <p className="pt-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Нет событий по выбранным фильтрам
          </p>
        )}
      </div>
    </section>
  );
}
