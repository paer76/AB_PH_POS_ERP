export const TZ = "Asia/Manila";

const pesoFmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function peso(n: number | string | null | undefined) {
  return pesoFmt.format(Number(n ?? 0));
}

export function num(n: number | string | null | undefined) {
  return Number(n ?? 0);
}

export function dateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PH", {
    timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function time(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

export function dateOnly(d: string | Date | null | undefined) {
  if (!d) return "—";
  // Plain "YYYY-MM-DD" strings are calendar dates: render without shifting the day.
  const v = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+08:00`) : new Date(d);
  return v.toLocaleDateString("en-PH", { timeZone: TZ, year: "numeric", month: "short", day: "numeric" });
}

/** Today's calendar date in Manila as YYYY-MM-DD. */
export function manilaToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "e_wallet", label: "GCash / e-wallet" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function methodLabel(m: string) {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
}

export const STATUS_LABEL: Record<string, string> = {
  pending_delivery: "Pending",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  voided: "Voided",
  paid: "Paid",
  unpaid: "Unpaid",
  partially_paid: "Partial",
};

/** Turn a Supabase/Postgres error into a message for a toast. */
export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong";
}
