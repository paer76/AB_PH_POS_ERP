"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { manilaToday, peso, time } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { OrderDetailDialog } from "@/components/order-detail";
import { Empty, Loading, PageHeader, StatusBadge } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function OrdersPage() {
  const supabase = createClient();
  const [day, setDay] = useState(manilaToday());
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const orderNo = Number(search.replace(/\D/g, ""));

  const q = useData(() => {
    let query = supabase
      .from("orders")
      .select("id, order_no, order_type, status, payment_status, total_amount, amount_paid, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (orderNo) query = query.eq("order_no", orderNo);
    else query = query.gte("created_at", `${day}T00:00:00+08:00`).lt("created_at", `${day}T23:59:59.999+08:00`);
    return query;
  }, [day, orderNo]);
  useRealtime(["orders", "payments"], q.reload);

  const active = q.data?.filter((o) => o.status !== "voided") ?? [];
  const total = active.reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div>
      <PageHeader
        title="Orders"
        description={q.data ? `${active.length} orders · ${peso(total)}` : undefined}
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Input type="date" className="h-11 flex-1 sm:w-44" value={day} max={manilaToday()} onChange={(e) => setDay(e.target.value)} />
            <Input placeholder="Order #" inputMode="numeric" className="h-11 w-28" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No orders.</Empty> : (
        <>
          {/* Phones: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {q.data.map((o) => (
              <button key={o.id} type="button" onClick={() => setDetail(o.id)}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left">
                <div className="min-w-0">
                  <p className="font-medium">#{o.order_no} · {o.clients?.name ?? "Walk-in"}</p>
                  <p className="text-xs text-muted-foreground">{time(o.created_at)} · {o.order_type === "delivery" ? "Delivery" : "Walk-in"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold">{peso(o.total_amount)}</span>
                  <StatusBadge status={o.status === "voided" ? "voided" : o.payment_status} />
                </div>
              </button>
            ))}
          </div>
          {/* Tablet/desktop: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead><TableHead>Time</TableHead><TableHead>Client</TableHead>
                  <TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetail(o.id)}>
                    <TableCell className="font-medium">{o.order_no}</TableCell>
                    <TableCell>{time(o.created_at)}</TableCell>
                    <TableCell>{o.clients?.name ?? "Walk-in"}</TableCell>
                    <TableCell>{o.order_type === "delivery" ? "Delivery" : "Walk-in"}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell><StatusBadge status={o.payment_status} /></TableCell>
                    <TableCell className="text-right">{peso(o.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <OrderDetailDialog orderId={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}
