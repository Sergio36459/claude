"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DemoBanner } from "@/components/DemoBanner";
import { HotkeysModal } from "@/components/HotkeysModal";
import { Legend } from "@/components/map/Legend";
import { MapView } from "@/components/map/MapView";
import { EventsPanel } from "@/components/panels/EventsPanel";
import { StatsPanel } from "@/components/panels/StatsPanel";
import { SearchModal } from "@/components/search/SearchModal";
import { TimelineBar } from "@/components/timeline/TimelineBar";
import { TopBar } from "@/components/layout/TopBar";
import { useUiStore } from "@/stores/uiStore";

export default function MapPage() {
  const eventsOpen = useUiStore((s) => s.eventsPanelOpen);
  const statsOpen = useUiStore((s) => s.statsPanelOpen);
  const toggleEvents = useUiStore((s) => s.toggleEventsPanel);
  const toggleStats = useUiStore((s) => s.toggleStatsPanel);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView />

      {/* верхняя панель */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-stretch gap-1.5 p-3">
        <TopBar />
        <div className="flex justify-center">
          <DemoBanner />
        </div>
      </div>

      {/* левая панель событий */}
      <AnimatePresence initial={false}>
        {eventsOpen && (
          <motion.aside
            key="events"
            initial={{ x: -380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            transition={{ type: "tween", duration: 0.22 }}
            className="panel-glass absolute bottom-40 left-3 top-20 z-10 hidden w-[340px] rounded-xl md:block"
          >
            <EventsPanel />
          </motion.aside>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={toggleEvents}
        aria-expanded={eventsOpen}
        className="panel-glass absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-r-lg px-1.5 py-4 text-xs md:block"
        style={{ color: "var(--text-secondary)" }}
        title="События (E)"
      >
        {eventsOpen ? "‹" : "События"}
      </button>

      {/* правая панель статистики */}
      <AnimatePresence initial={false}>
        {statsOpen && (
          <motion.aside
            key="stats"
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: "tween", duration: 0.22 }}
            className="panel-glass absolute bottom-40 right-3 top-20 z-10 hidden w-[320px] rounded-xl md:block"
          >
            <StatsPanel />
          </motion.aside>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={toggleStats}
        aria-expanded={statsOpen}
        className="panel-glass absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-l-lg px-1.5 py-4 text-xs md:block"
        style={{ color: "var(--text-secondary)" }}
        title="Статистика (S)"
      >
        {statsOpen ? "›" : "Статистика"}
      </button>

      {/* легенда */}
      <div className="absolute bottom-40 right-3 z-10 md:bottom-44 md:right-[340px]">
        {!statsOpen && <Legend />}
      </div>

      {/* таймлайн */}
      <div className="absolute inset-x-3 bottom-3 z-20">
        <TimelineBar />
      </div>

      {/* мобильные панели: снизу листом */}
      <div className="absolute inset-x-3 bottom-36 z-10 max-h-[38dvh] overflow-hidden rounded-xl md:hidden">
        {eventsOpen && (
          <div className="panel-glass h-full max-h-[38dvh] overflow-y-auto rounded-xl">
            <EventsPanel />
          </div>
        )}
      </div>

      <SearchModal />
      <HotkeysModal />
    </main>
  );
}
