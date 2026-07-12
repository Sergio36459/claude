"use client";

export function Legend() {
  const rows = [
    { swatch: <span className="inline-block h-3 w-5 rounded-sm" style={{ background: "var(--map-ru-fill)", opacity: 0.35 }} />, label: "Под контролем РФ" },
    { swatch: <span className="inline-block h-0.5 w-5" style={{ background: "var(--map-ru-line)" }} />, label: "Линия фронта" },
    { swatch: <span className="inline-block h-3 w-5 rounded-sm" style={{ background: "var(--map-gain-ru)", opacity: 0.6 }} />, label: "Занято за день" },
    { swatch: <span className="inline-block h-3 w-5 rounded-sm" style={{ background: "var(--map-gain-ua)", opacity: 0.6 }} />, label: "Освобождено за день" },
    { swatch: <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#eda100" }} />, label: "Событие (цвет = тип)" },
  ];
  return (
    <div className="panel-glass rounded-lg px-3 py-2 text-xs" aria-label="Легенда карты">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5" style={{ color: "var(--text-secondary)" }}>
          {r.swatch}
          {r.label}
        </div>
      ))}
    </div>
  );
}
