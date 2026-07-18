"use client";

import { useUiStore } from "@/stores/uiStore";

const KEYS: Array<[string, string]> = [
  ["← / →", "±1 день"],
  ["Shift + ← / →", "±1 месяц"],
  ["Alt + ← / →", "±1 год"],
  ["Пробел", "воспроизведение / пауза"],
  ["+ / −", "скорость воспроизведения"],
  ["Ctrl/⌘ + K, /", "поиск"],
  ["E", "панель событий"],
  ["S", "панель статистики"],
  ["T", "тема"],
  ["Home / End", "первая / последняя дата"],
  ["?", "эта справка"],
];

export function HotkeysModal() {
  const open = useUiStore((s) => s.hotkeysOpen);
  const setOpen = useUiStore((s) => s.setHotkeysOpen);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Горячие клавиши"
    >
      <div className="panel-glass w-full max-w-sm rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Горячие клавиши
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {KEYS.map(([k, v]) => (
              <tr key={k}>
                <td className="py-1 pr-3">
                  <kbd
                    className="rounded border px-1.5 py-0.5 text-xs"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    {k}
                  </kbd>
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
