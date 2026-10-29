"use client";

import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";

/** The signed-in user's open shift (or null), kept live. */
export function useMyShift() {
  const { id } = useProfile();
  const q = useData(
    () =>
      createClient()
        .from("shifts")
        .select("*")
        .eq("secretary_id", id)
        .eq("status", "open")
        .maybeSingle(),
    [id],
  );
  useRealtime(["shifts"], q.reload);
  return { shift: q.data, loading: q.loading, reload: q.reload };
}

export type ShiftSummary = {
  shift_id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  cash_payments: number;
  non_cash_payments: number;
  cash_in: number;
  cash_out: number;
  expenses: number;
  orders: number;
  sales: number;
  expected_cash: number;
  closing_cash: number | null;
  variance: number | null;
};
