"use client";

import { useEffect } from "react";
import { isValidIsoDate } from "@uwt/shared";
import { useDateStore } from "@/stores/dateStore";

/** URL как состояние: /?d=YYYY-MM-DD — сцену можно отправить ссылкой (улучшение №7). */
export function useUrlSync(): void {
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("d");
    if (param && isValidIsoDate(param)) {
      useDateStore.getState().setDate(param);
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useDateStore.subscribe((s, prev) => {
      if (s.date === prev.date) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("d", s.date);
        window.history.replaceState(null, "", url.toString());
      }, 300);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
