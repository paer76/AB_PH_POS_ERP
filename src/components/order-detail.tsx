"use client";

import Link from "next/link";
import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { dateTime, errMsg, methodLabel, peso, type PaymentMethod } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { MethodSelect, MoneyInput, ReferenceField } from "@/components/payment-fields";
import { Field, Loading, Row, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export const ORDER_SELECT =
  "*, clients(id, name, phone, address), riders(name), order_items(id, quantity, unit_price, subtotal, products(name, category)), payments(id, amount, method, reference, created_at), void_requests(id, status, reason)";

export function useOrder(orderId: string | null) {
  const q = useData(
    async () => {
      if (!orderId) return { data: null, error: null };
      return await createClient().from("orders").select(ORDER_SELECT).eq("id", orderId).single();
    },
    [orderId],
  );
  useRealtime(["orders", "payments", "void_requests"], () => orderId && q.reload());
  return q;
}

export function OrderDetailDialog({ orderId, onOpenChange }: { orderId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data: o, loading, reload } = useOrder(orderId);
  const [mode, setMode] = useState<"view" | "pay" | "void">("view");
  const balance = o ? Number(o.total_amount) - Number(o.amount_paid) : 0;
  const pendingVoid = o?.void_requests?.some((v) => v.status === "pending");

  return (
    <ResponsiveDialog
      open={!!orderId}
      onOpenChange={(open) => { if (!open) setMode("view"); onOpenChange(open); }}
      title={o ? `Order #${o.order_no}` : "Order"}
      description={o ? `${o.clients?.name ?? "Walk-in"} · ${dateTime(o.created_at)}` : undefined}
    >
      {loading || !o ? <Loading /> : mode === "pay" ? (
        <PaymentForm orderId={o.id} balance={balance} onDone={() => { setMode("view"); void reload(); }} onCancel={() => setMode("view")} />
      ) : mode === "void" ? (
        <VoidForm orderId={o.id} onDone={() => { setMode("view"); void reload(); }} onCancel={() => setMode("view")} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={o.status} />
            <StatusBadge status={o.payment_status} />
            {o.order_type === "delivery" && <span className="text-xs text-muted-foreground">Rider: {o.riders?.name ?? "—"}</span>}
            {pendingVoid && <StatusBadge status="pending" />}
          </div>
          {o.delivery_address && <p className="text-sm text-muted-foreground">{o.delivery_address}</p>}

          <div className="flex flex-col gap-1">
            {o.order_items.map((i) => (
              <Row key={i.id} label={`${i.quantity} × ${i.products?.name}`}>{peso(i.subtotal)}</Row>
            ))}
          </div>
          <Separator />
          <Row label="Total" className="text-base">{peso(o.total_amount)}</Row>
          <Row label="Paid">{peso(o.amount_paid)}</Row>
          {balance > 0 && o.status !== "voided" && <Row label="Balance" className="text-destructive">{peso(balance)}</Row>}

          {o.payments.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Payments</p>
              {o.payments.map((p) => (
                <Row key={p.id} label={`${dateTime(p.created_at)} · ${methodLabel(p.method)}${p.reference ? ` (${p.reference})` : ""}`}>{peso(p.amount)}</Row>
              ))}
            </div>
          )}
          {o.notes && <p className="text-sm"><span className="text-muted-foreground">Notes:</span> {o.notes}</p>}
          {o.soa_id && <p className="text-xs text-muted-foreground">Billed on a Statement of Account.</p>}

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="touch" asChild>
              <Link href={`/receipt/${o.order_no}`}><Printer /> Receipt</Link>
            </Button>
            {o.status !== "voided" && balance > 0 && (
              <Button size="touch" onClick={() => setMode("pay")}>Record payment</Button>
            )}
            {o.status !== "voided" && !pendingVoid && !o.soa_id && (
              <Button variant="destructive" size="touch" onClick={() => setMode("void")}>Request void</Button>
            )}
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}

export function PaymentForm({ orderId, balance, onDone, onCancel }: {
  orderId: string; balance: number; onDone: () => void; onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc("record_payment", {
      p_order_id: orderId, p_amount: Number(amount), p_method: method, p_reference: reference,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Payment recorded");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Balance: {peso(balance)}</p>
      <Field label="Amount" htmlFor="pay-amt"><MoneyInput id="pay-amt" value={amount} onChange={setAmount} autoFocus /></Field>
      <Field label="Method"><MethodSelect value={method} onChange={setMethod} /></Field>
      <ReferenceField method={method} value={reference} onChange={setReference} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="touch" onClick={onCancel}>Back</Button>
        <Button size="touch" onClick={save} disabled={busy || !Number(amount)}>Save payment</Button>
      </div>
    </div>
  );
}

function VoidForm({ orderId, onDone, onCancel }: { orderId: string; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { data, error } = await createClient().rpc("request_void", { p_order_id: orderId, p_reason: reason });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(data?.status === "approved" ? "Order voided" : "Void request sent to the owner");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        The owner must approve voids. Stock and container counts are reversed when approved.
      </p>
      <Field label="Reason" htmlFor="void-reason">
        <Textarea id="void-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong item entered" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="touch" onClick={onCancel}>Back</Button>
        <Button variant="destructive" size="touch" onClick={save} disabled={busy || !reason.trim()}>Send request</Button>
      </div>
    </div>
  );
}
