import Link from "next/link";
import { SOURCES } from "@uwt/shared";

export const metadata = { title: "Методология — UWT" };

export default function MethodologyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm" style={{ color: "var(--series-canonical)" }}>
        ← Карта
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        Методология и источники
      </h1>

      <div className="mb-6 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        <strong style={{ color: "var(--text-primary)" }}>Режимы датасета.</strong> Платформа
        собирается в двух режимах (плашка в шапке показывает активный):
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong style={{ color: "var(--text-primary)" }}>Реальные данные</strong>{" "}
            (<code>pnpm gen:real</code>): потери — официальные ежедневные сводки Генштаба ВСУ
            (зеркало russianwarship.rip), по текущий день; геометрия фронта — полная история
            DeepState (при доступной сети; иначе — кейфрейм-приближение с явной пометкой);
            события — только реальные ключевые.
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>Демо</strong>{" "}
            (<code>pnpm gen:demo</code>): синтетическое приближение для разработки,{" "}
            <strong style={{ color: "var(--text-primary)" }}>непригодно для цитирования</strong>.
          </li>
        </ul>
        <p className="mt-2">
          Числа Генштаба ВСУ — заявление стороны конфликта (колонка «заявлено»); по инварианту
          проекта они никогда не объединяются с другими источниками.
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Принципы данных
        </h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Каждый факт содержит ссылку на источник — без источника данные не публикуются.</li>
          <li>
            <strong>Оценки разных источников никогда не объединяются в одно число.</strong> Если
            данные расходятся, отображаются все версии отдельными колонками/линиями с указанием
            источника. Альтернативные оценки не удаляются.
          </li>
          <li>Один день = календарный день (UTC); «сегодняшний» день помечается как предварительный.</li>
          <li>Каноническая геометрия фронта на день берётся из одного источника и сверяется с другими; источники геометрии не смешиваются.</li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Уровни достоверности
        </h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>подтверждено</strong> — несколько независимых источников или визуальное подтверждение;</li>
          <li><strong>сообщается</strong> — надёжный источник, независимое подтверждение отсутствует;</li>
          <li><strong>заявлено</strong> — заявление стороны конфликта, не подтверждено независимо;</li>
          <li><strong>оспаривается</strong> — источники прямо противоречат друг другу.</li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Источники (в порядке приоритета)
        </h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.code} className="border-t align-top" style={{ borderColor: "var(--grid)" }}>
                <td className="py-2 pr-3 font-medium" style={{ color: "var(--text-primary)" }}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">
                    {s.name}
                  </a>
                </td>
                <td className="py-2">{s.reliabilityNote}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="pt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Картографическая подложка
        </h2>
        <p>
          Границы стран, области Украины и города — Natural Earth (public domain,
          naturalearthdata.com); шрифты подписей — KlokanTech Noto Sans (OFL). Подложка
          хранится в приложении и не обращается к внешним тайл-серверам; карта ограничена
          регионом Украины, европейской части России и соседних стран.
        </p>

        <h2 className="pt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Известные ограничения демо-датасета
        </h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Крым и Донбасс на 24.02.2022 соединены тонкой прибрежной полосой (реально сухопутный коридор замкнулся в марте 2022).</li>
          <li>Курская операция 2024 года не отображается (модель отслеживает только территорию Украины).</li>
          <li>Изменения фронта между ключевыми датами интерполированы равномерно.</li>
          <li>Числа потерь — синтетическая интерполяция годовых порядков величин.</li>
        </ul>
      </section>
    </main>
  );
}
