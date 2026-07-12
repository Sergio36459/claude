"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { EquipmentCategory } from "@uwt/shared";
import { useDayBundle } from "@/lib/data";
import { fmtInt, fmtSigned } from "@/lib/format";
import { useDateStore } from "@/stores/dateStore";
import { useUiStore } from "@/stores/uiStore";

const CATEGORY_LABEL: Partial<Record<EquipmentCategory, string>> = {
  tank: "Танки",
  ifv: "БМП",
  apc: "БТР",
  artillery: "Артиллерия",
  air_defense: "ПВО",
  aircraft: "Самолёты",
  helicopter: "Вертолёты",
  uav: "БПЛА",
  ship: "Корабли",
};

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-lg font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function StatsPanel() {
  const date = useDateStore((s) => s.date);
  const { data: bundle } = useDayBundle(date);
  const side = useUiStore((s) => s.lossesSide);
  const setSide = useUiStore((s) => s.setLossesSide);

  const personnel = useMemo(
    () => bundle?.losses.personnel.filter((p) => p.side === side) ?? [],
    [bundle, side],
  );
  const equipment = useMemo(() => {
    const recs = bundle?.losses.equipment.filter((r) => r.side === side) ?? [];
    const byCat = new Map<string, typeof recs>();
    for (const r of recs) {
      const arr = byCat.get(r.category) ?? [];
      arr.push(r);
      byCat.set(r.category, arr);
    }
    return byCat;
  }, [bundle, side]);

  if (!bundle) {
    return (
      <div className="space-y-2 p-3" aria-hidden>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ background: "var(--grid)" }} />
        ))}
      </div>
    );
  }

  const s = bundle.stats;
  const deltaGood = s.areaChangeSqkm < 0; // отрицательная дельта = освобождение

  return (
    <section className="flex h-full flex-col overflow-y-auto p-3" aria-label="Статистика дня">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          День войны {s.dayNumber}
        </h2>
        {bundle.preliminary && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            предварительно
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Под контролем РФ, км²" value={fmtInt(s.areaRuSqkm)} />
        <StatTile
          label="Δ за день, км²"
          value={fmtSigned(s.areaChangeSqkm)}
          sub={s.areaChangeSqkm === 0 ? "без изменений" : deltaGood ? "освобождено" : "занято"}
        />
        <StatTile label="Линия фронта, км" value={fmtInt(s.frontlineLenKm)} />
        <StatTile
          label="События"
          value={fmtInt(s.eventsTotal)}
          sub={`ракеты ${s.strikesMissile} · БПЛА ${s.strikesUav}`}
        />
      </div>

      {(bundle.diffSummary.gainedRuSqkm > 0 || bundle.diffSummary.gainedUaSqkm > 0) && (
        <div className="mt-2 rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
          <div className="mb-1 font-medium" style={{ color: "var(--text-primary)" }}>
            Что изменилось за день
          </div>
          {bundle.diffSummary.gainedRuSqkm > 0 && (
            <div style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--map-gain-ru)" }}>■</span> занято:{" "}
              {bundle.diffSummary.gainedRuSqkm} км²
            </div>
          )}
          {bundle.diffSummary.gainedUaSqkm > 0 && (
            <div style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--map-gain-ua)" }}>■</span> освобождено:{" "}
              {bundle.diffSummary.gainedUaSqkm} км²
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Потери (накопленные)
        </h3>
        <div className="flex overflow-hidden rounded-md border text-xs" style={{ borderColor: "var(--border)" }}>
          {(["ru", "ua"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={side === v}
              onClick={() => setSide(v)}
              className="px-2 py-0.5"
              style={{
                background: side === v ? "var(--series-canonical)" : "transparent",
                color: side === v ? "#fff" : "var(--text-secondary)",
              }}
            >
              {v === "ru" ? "РФ" : "Украина"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="px-2 pt-2 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          Личный состав — по источникам, не суммируются
        </div>
        <table className="w-full text-xs">
          <tbody>
            {personnel.map((p) => (
              <tr key={p.sourceCode + p.metric} className="border-t" style={{ borderColor: "var(--grid)" }}>
                <td className="px-2 py-1.5">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted"
                    style={{ color: "var(--text-secondary)" }}
                    title={p.methodNote ?? undefined}
                  >
                    {p.sourceName}
                  </a>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {p.metric === "killed_confirmed_named"
                      ? "погибшие, поимённо"
                      : p.metric === "casualties_total"
                        ? "суммарно, заявлено"
                        : "погибшие, оценка"}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right align-top font-medium tnum" style={{ color: "var(--text-primary)" }}>
                  {p.valueMin === p.valueMax
                    ? fmtInt(p.valueMin)
                    : `${fmtInt(p.valueMin)}–${fmtInt(p.valueMax)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="px-2 pt-2 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          Техника — колонки по источникам
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="px-2 py-1 text-left font-normal">Категория</th>
              <th className="px-2 py-1 text-right font-normal">Oryx</th>
              <th className="px-2 py-1 text-right font-normal">
                {side === "ru" ? "Генштаб ВСУ" : "МО РФ"}
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CATEGORY_LABEL).map(([cat, label]) => {
              const recs = equipment.get(cat) ?? [];
              if (recs.length === 0) return null;
              const oryx = recs
                .filter((r) => r.sourceCode === "oryx")
                .reduce((sum, r) => sum + r.count, 0);
              const official = recs.find((r) => r.status === "total_claimed");
              return (
                <tr key={cat} className="border-t" style={{ borderColor: "var(--grid)" }}>
                  <td className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
                    {label}
                  </td>
                  <td className="px-2 py-1 text-right tnum" style={{ color: "var(--text-primary)" }}>
                    {recs.some((r) => r.sourceCode === "oryx") ? fmtInt(oryx) : "—"}
                  </td>
                  <td className="px-2 py-1 text-right tnum" style={{ color: "var(--text-primary)" }}>
                    {official ? fmtInt(official.count) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-2 py-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
          Oryx — визуально подтверждённые (уничтожено+захвачено); официальные заявления — отдельной
          колонкой. Оценки не объединяются.
        </p>
      </div>

      <Link
        href="/stats"
        className="mt-3 block rounded-lg border px-3 py-2 text-center text-sm hover:bg-black/5 dark:hover:bg-white/5"
        style={{ borderColor: "var(--border)", color: "var(--series-canonical)" }}
      >
        Графики динамики →
      </Link>
    </section>
  );
}
