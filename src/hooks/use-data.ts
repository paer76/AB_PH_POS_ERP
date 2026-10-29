"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { errMsg } from "@/lib/format";

type AnyResult = { data: unknown; error: { message: string } | null };

/**
 * Minimal client-side loader for Supabase queries.
 * `fetcher` returns a Supabase query result; `deps` re-run it.
 * `reload()` refetches in place (keeps showing current data while it runs);
 * changing `deps` clears data and shows loading until the new result arrives.
 */
export function useData<R extends AnyResult>(fetcher: () => PromiseLike<R>, deps: unknown[] = []) {
  type T = NonNullable<R["data"]>;
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null, data: null, error: null,
  });

  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  const seq = useRef(0);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = key;
  });

  const reload = useCallback(async () => {
    const id = ++seq.current;
    const k = keyRef.current;
    let next: { data: T | null; error: string | null };
    try {
      const res = await fetcherRef.current();
      next = res.error ? { data: null, error: res.error.message } : { data: (res.data ?? null) as T | null, error: null };
    } catch (e) {
      next = { data: null, error: errMsg(e) };
    }
    if (id !== seq.current) return; // a newer request superseded this one
    setState((prev) => ({
      key: k,
      // keep the previous data on a failed background refresh
      data: next.error && prev.key === k ? prev.data : next.data,
      error: next.error,
    }));
  }, []);

  useEffect(() => {
    void reload();
  }, [key, reload]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
    reload,
  };
}
