"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useManifest } from "@/lib/data";
import { useHotkeys } from "@/hooks/useHotkeys";
import { usePlayback } from "@/hooks/usePlayback";
import { useUrlSync } from "@/hooks/useUrlSync";
import { useDateStore } from "@/stores/dateStore";
import { hydrateUiStore } from "@/stores/uiStore";

function GlobalEffects({ children }: { children: React.ReactNode }) {
  useHotkeys();
  usePlayback();
  useUrlSync();
  const { data: manifest } = useManifest();

  useEffect(() => {
    hydrateUiStore();
  }, []);

  useEffect(() => {
    if (!manifest) return;
    useDateStore.getState().setLastDate(manifest.lastDate);
    // без явной даты в URL открываем последний доступный день
    const hasParam = new URLSearchParams(window.location.search).has("d");
    if (!hasParam) useDateStore.getState().setDate(manifest.lastDate);
  }, [manifest]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <GlobalEffects>{children}</GlobalEffects>
    </QueryClientProvider>
  );
}
