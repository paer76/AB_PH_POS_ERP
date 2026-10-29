"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { dateTime, errMsg, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { OrderDetailDialog } from "@/components/order-detail";
import { Empty, Loading, PageHeader, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function VoidsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [detail, setDetail] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const q = useData(() => {
    const query = supabase.from("void_requests")
      .select("*, orders(id, order_no, total_amount, amount_paid, created_at, clients(name)), requester:profiles!void_requests_requested_by_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(100);
    return tab === "pending" ? query.eq("status", "pending") : query.neq("status", "pending");
  }, [tab]);
  useRealtime(["void_requests"], q.reload);

  async function review(id: string, approve: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("review_void", { p_request_id: id, p_approve: approve, p_notes: notes[id] });
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success(approve ? "Order voided" : "Request rejected");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Void requests" description="Approving a void reverses stock and container counts. The order stays in the records, marked voided." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList className="h-11"><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
      </Tabs>
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>{tab === "pending" ? "Nothing to approve." : "No history yet."}</Empty> : (
        <div className="flex flex-col gap-3">
          {q.data.map((r) => (
            <Card key={r.id} className="py-0">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left" onClick={() => r.orders && setDetail(r.orders.id)}>
                    <p className="font-semibold text-primary">Order #{r.orders?.order_no} · {r.orders?.clients?.name ?? "Walk-in"}</p>
                    <p className="text-xs text-muted-foreground">
                      {peso(r.orders?.total_amount)} (paid {peso(r.orders?.amount_paid)}) · ordered {dateTime(r.orders?.created_at)}
                    </p>
                  </button>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                <p className="text-xs text-muted-foreground">Requested by {r.requester?.full_name} · {dateTime(r.created_at)}</p>
                {r.review_notes && <p className="text-sm"><span className="text-muted-foreground">Owner note:</span> {r.review_notes}</p>}
                {r.status === "pending" && (
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <Input className="h-11 flex-1" placeholder="Note (optional)" value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="touch" variant="outline" disabled={busy === r.id} onClick={() => review(r.id, false)}>Reject</Button>
                      <Button size="touch" variant="destructive" disabled={busy === r.id} onClick={() => review(r.id, true)}>Approve void</Button>
                    </div>
                  </div>
                )}
                {Number(r.orders?.amount_paid) > 0 && r.status === "pending" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">This order has payments: refund the customer if you approve.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <OrderDetailDialog orderId={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}
