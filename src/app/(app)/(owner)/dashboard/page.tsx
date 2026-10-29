"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { manilaToday, methodLabel, peso, time } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import type { ShiftSummary } from "@/hooks/use-shift";
import { OrderDetailDialog } from "@/components/order-detail";
import { Empty, Loading, PageHeader, Row, StatusBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Summary = {
  date: string; sales: number; orders: number; walk_ins: number; deliveries: number; refills: number;
  collected: number; collected_by_method: Record<string, number>; expenses: number;
  pending_deliveries: number; out_for_delivery: number; receivables: number; pending_voids: number;
  open_shifts: { shift_id: string; secretary: string; opened_at: string; summary: ShiftSummary }[];
};

export default function DashboardPage() {
  const supabase = createClient();
  const [day, setDay] = useState(manilaToday());
  const [detail, setDetail] = useState<string | null>(null);
  const isToday = day === manilaToday();

  const summary = useData(() => supabase.rpc("dashboard_summary", { p_date: day }), [day]);
  const feed = useData(
    () => supabase.from("orders")
      .select("id, order_no, order_type, status, payment_status, total_amount, created_at, clients(name)")
      .gte("created_at", `${day}T00:00:00+08:00`).lt("created_at", `${day}T23:59:59.999+08:00`)
      .order("created_at", { ascending: false }).limit(15),
    [day],
  );
  useRealtime(["orders", "payments", "shifts", "cash_movements", "void_requests"], () => {
    void summary.reload();
    void feed.reload();
  });

  const s = summary.data as Summary | null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={isToday
          ? <span className="inline-flex items-center gap-1 text-emerald-600"><Radio className="size-4 animate-pulse" /> Live</span>
          : "Viewing a past day"}
        actions={<Input type="date" className="h-11 w-44" value={day} max={manilaToday()} onChange={(e) => setDay(e.target.value || manilaToday())} />}
      />

      {!s ? <Loading /> : (
        <div className="flex flex-col gap-4">
          {s.pending_voids > 0 && (
            <Link href="/voids" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="size-4" /> {s.pending_voids} void request{s.pending_voids > 1 ? "s" : ""} waiting for approval
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Sales" value={peso(s.sales)} sub={`${s.orders} orders · ${s.walk_ins} walk-in · ${s.deliveries} delivery`} />
            <Tile label="Collected" value={peso(s.collected)} sub={Object.entries(s.collected_by_method).map(([m, v]) => `${methodLabel(m)} ${peso(v)}`).join(" · ") || "—"} />
            <Tile label="Refills sold" value={String(s.refills)} sub="gallons (refill items)" />
            <Tile label="Expenses" value={peso(s.expenses)} sub="paid from drawers" />
            <Tile label="Receivables (utang)" value={peso(s.receivables)} sub="all unpaid balances" href="/clients" />
            <Tile label="Pending deliveries" value={String(s.pending_deliveries)} href="/deliveries" />
            <Tile label="Out for delivery" value={String(s.out_for_delivery)} href="/deliveries" />
            <Tile label="Open shifts" value={String(s.open_shifts.length)} href="/shifts" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Open shifts — cash in drawer</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                {!s.open_shifts.length ? <p className="text-sm text-muted-foreground">No one is on shift.</p> : s.open_shifts.map((sh) => (
                  <div key={sh.shift_id} className="rounded-lg border p-3">
                    <p className="mb-2 font-medium">{sh.secretary} <span className="text-xs text-muted-foreground">since {time(sh.opened_at)}</span></p>
                    <Row label="Opening cash">{peso(sh.summary.opening_cash)}</Row>
                    <Row label="Cash sales">{peso(sh.summary.cash_payments)}</Row>
                    <Row label="Expenses / cash out">{peso(Number(sh.summary.expenses) + Number(sh.summary.cash_out))}</Row>
                    <Row label="Expected in drawer" className="text-base">{peso(sh.summary.expected_cash)}</Row>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Latest orders</CardTitle></CardHeader>
              <CardContent>
                {!feed.data?.length ? <Empty>No orders yet.</Empty> : (
                  <div className="flex flex-col divide-y">
                    {feed.data.map((o) => (
                      <button key={o.id} type="button" onClick={() => setDetail(o.id)} className="flex items-center justify-between gap-2 py-2 text-left text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">#{o.order_no} · {o.clients?.name ?? "Walk-in"}</p>
                          <p className="text-xs text-muted-foreground">{time(o.created_at)} · {o.order_type === "delivery" ? "Delivery" : "Walk-in"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold">{peso(o.total_amount)}</span>
                          <StatusBadge status={o.status === "voided" ? "voided" : o.order_type === "delivery" && o.status !== "completed" ? o.status : o.payment_status} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <OrderDetailDialog orderId={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}

function Tile({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <Card className="h-full gap-1 py-3 transition-colors hover:bg-muted/40">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums md:text-2xl">{value}</p>
        {sub && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
