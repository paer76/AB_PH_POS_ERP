"use client";

import { useState } from "react";
import { MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errMsg, manilaToday, peso, time } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { OrderDetailDialog } from "@/components/order-detail";
import { Empty, Field, Loading, PageHeader, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SELECT =
  "id, order_no, status, payment_status, total_amount, amount_paid, delivery_address, created_at, dispatched_at, completed_at, rider_id, clients(name, phone, container_balance), riders(name), order_items(quantity, products(name, category))";

type Tab = "pending_delivery" | "out_for_delivery" | "completed";

export default function DeliveriesPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("pending_delivery");
  const [detail, setDetail] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: "dispatch" | "complete"; order: Delivery } | null>(null);

  const q = useData(() => {
    let query = supabase.from("orders").select(SELECT).eq("order_type", "delivery").eq("status", tab);
    if (tab === "completed") {
      query = query.gte("completed_at", `${manilaToday()}T00:00:00+08:00`).order("completed_at", { ascending: false });
    } else {
      query = query.order("created_at");
    }
    return query.limit(100);
  }, [tab]);
  useRealtime(["orders"], q.reload);
  const counts = useData(async () => {
    const [p, o] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_delivery"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "out_for_delivery"),
    ]);
    return { data: { pending: p.count ?? 0, out: o.count ?? 0 }, error: p.error ?? o.error };
  });
  useRealtime(["orders"], counts.reload);

  async function backToPending(o: Delivery) {
    const { error } = await supabase.rpc("update_delivery_status", { p_order_id: o.id, p_status: "pending_delivery" });
    if (error) toast.error(errMsg(error)); else toast.success(`#${o.order_no} moved back to pending`);
  }

  return (
    <div>
      <PageHeader title="Deliveries" description="Pending → Out for delivery → Completed" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList className="grid h-11 w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="pending_delivery">Pending{counts.data ? ` (${counts.data.pending})` : ""}</TabsTrigger>
          <TabsTrigger value="out_for_delivery">Out{counts.data ? ` (${counts.data.out})` : ""}</TabsTrigger>
          <TabsTrigger value="completed">Done today</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No deliveries here.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((o) => (
            <Card key={o.id} className="gap-0 py-0">
              <CardContent className="flex flex-col gap-2 p-4">
                <button type="button" className="flex items-start justify-between gap-2 text-left" onClick={() => setDetail(o.id)}>
                  <div>
                    <p className="font-semibold">#{o.order_no} · {o.clients?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {time(o.created_at)}{o.riders?.name ? ` · ${o.riders.name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{peso(o.total_amount)}</p>
                    <StatusBadge status={o.payment_status} />
                  </div>
                </button>
                <p className="text-sm">{o.order_items.map((i) => `${i.quantity}× ${i.products?.name}`).join(", ")}</p>
                {o.delivery_address && (
                  <a className="flex items-center gap-1 text-sm text-primary" target="_blank" rel="noreferrer"
                    href={`https://maps.google.com/?q=${encodeURIComponent(o.delivery_address)}`}>
                    <MapPin className="size-4 shrink-0" /> <span className="truncate">{o.delivery_address}</span>
                  </a>
                )}
                {o.clients?.phone && (
                  <a className="flex items-center gap-1 text-sm text-primary" href={`tel:${o.clients.phone}`}>
                    <Phone className="size-4" /> {o.clients.phone}
                  </a>
                )}
                <div className="mt-1 flex gap-2">
                  {o.status === "pending_delivery" && (
                    <>
                      <Button size="touch" className="flex-1" onClick={() => setAction({ kind: "dispatch", order: o })}>Dispatch</Button>
                      <Button size="touch" variant="outline" onClick={() => setAction({ kind: "complete", order: o })}>Done</Button>
                    </>
                  )}
                  {o.status === "out_for_delivery" && (
                    <>
                      <Button size="touch" className="flex-1" onClick={() => setAction({ kind: "complete", order: o })}>Mark delivered</Button>
                      <Button size="touch" variant="outline" onClick={() => backToPending(o)}>Undo</Button>
                    </>
                  )}
                  {o.status === "completed" && <StatusBadge status="completed" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StatusDialog action={action} onClose={() => setAction(null)} />
      <OrderDetailDialog orderId={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}

type Delivery = {
  id: string; order_no: number; rider_id: string | null;
  clients: { name: string; phone: string | null; container_balance: number } | null;
  order_items: { quantity: number; products: { name: string; category: string } | null }[];
};

function StatusDialog({ action, onClose }: { action: { kind: "dispatch" | "complete"; order: Delivery } | null; onClose: () => void }) {
  const supabase = createClient();
  const riders = useData(() => supabase.from("riders").select("id, name").eq("is_active", true).order("name"));
  const [riderId, setRiderId] = useState("");
  const [delivered, setDelivered] = useState("0");
  const [pulled, setPulled] = useState("0");
  const [busy, setBusy] = useState(false);

  const [last, setLast] = useState<typeof action>(null);
  if (action !== last) {
    setLast(action);
    if (action) {
      const refills = action.order.order_items
        .filter((i) => i.products?.category === "refill")
        .reduce((s, i) => s + i.quantity, 0);
      setRiderId(action.order.rider_id ?? "");
      setDelivered(String(refills));
      setPulled(String(refills)); // usual swap: one empty back per full gallon
    }
  }

  async function save() {
    if (!action) return;
    if (action.kind === "dispatch" && !riderId) return toast.error("Choose a rider");
    setBusy(true);
    const { error } = await supabase.rpc("update_delivery_status", {
      p_order_id: action.order.id,
      p_status: action.kind === "dispatch" ? "out_for_delivery" : "completed",
      p_rider_id: riderId || undefined,
      p_gallons_delivered: action.kind === "complete" ? Number(delivered || 0) : 0,
      p_gallons_pulled_out: action.kind === "complete" ? Number(pulled || 0) : 0,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(action.kind === "dispatch" ? "Out for delivery" : "Delivery completed");
    onClose();
  }

  return (
    <ResponsiveDialog
      open={!!action} onOpenChange={(o) => !o && onClose()}
      title={action?.kind === "dispatch" ? `Dispatch #${action?.order.order_no}` : `Complete #${action?.order.order_no}`}
      description={action?.order.clients?.name}
      footer={<Button size="touch" className="w-full" onClick={save} disabled={busy}>
        {action?.kind === "dispatch" ? "Send out" : "Mark completed"}
      </Button>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Rider">
          <Select value={riderId} onValueChange={setRiderId}>
            <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose rider" /></SelectTrigger>
            <SelectContent>
              {riders.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {action?.kind === "complete" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gallons delivered" htmlFor="g-del">
                <Input id="g-del" inputMode="numeric" className="h-11" value={delivered} onChange={(e) => setDelivered(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Empties pulled out" htmlFor="g-pull">
                <Input id="g-pull" inputMode="numeric" className="h-11" value={pulled} onChange={(e) => setPulled(e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Client currently holds {action.order.clients?.container_balance ?? 0} of our containers →
              will hold {(action.order.clients?.container_balance ?? 0) + Number(delivered || 0) - Number(pulled || 0)}.
            </p>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
