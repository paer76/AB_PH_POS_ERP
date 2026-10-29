"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Table = "orders" | "payments" | "shifts" | "cash_movements" | "void_requests";

/**
 * Calls `onChange` (debounced) whenever rows in the given tables change.
 * Realtime respects RLS, so each user only hears about rows they may read.
 * Pages re-fetch their summary on change instead of patching state by hand,
 * which keeps totals correct and is cheap at a single store's volume.
 */
export function useRealtime(tables: Table[], onChange: () => void, debounceMs = 400) {
  const cb = useRef(onChange);
  useLayoutEffect(() => {
    cb.current = onChange;
  });
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), debounceMs);
    };

    let channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, fire);
    }
    channel.subscribe();

    // Catch up after the phone/tablet wakes up or regains focus.
    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [key, debounceMs]);
}
