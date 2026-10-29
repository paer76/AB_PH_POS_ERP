"use client";

import { use, useState } from "react";
import { Pencil, Phone, Repeat } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";
import { dateTime, errMsg, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { useProfile } from "@/components/profile-provider";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { OrderDetailDialog } from "@/components/order-detail";
import { MoneyInput } from "@/components/payment-fields";
import { Empty, Field, Loading, PageHeader, Row, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Client = Tables<"clients">;

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const { role } = useProfile();
  const isOwner = role === "owner";
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const client = useData(() => supabase.from("clients").select("*").eq("id", id).single(), [id]);
  const balance = useData(() => supabase.from("v_client_balances").select("outstanding, unpaid_orders").eq("client_id", id).single(), [id]);
  const orders = useData(
    () => supabase.from("orders").select("id, order_no, created_at, status, payment_status, total_amount, amount_paid, order_type")
      .eq("client_id", id).order("created_at", { ascending: false }).limit(100),
    [id],
  );
  const logs = useData(
    () => supabase.from("container_logs").select("*").eq("client_id", id).order("logged_at", { ascending: false }).limit(100),
    [id],
  );
  const reloadAll = () => { void client.reload(); void balance.reload(); void orders.reload(); void logs.reload(); };
  useRealtime(["orders", "payments"], reloadAll, 600);

  if (client.loading && !client.data) return <Loading />;
  const c = client.data;
  if (!c) return <Empty>Client not found.</Empty>;
  const unpaid = orders.data?.filter((o) => o.status !== "voided" && o.payment_status !== "paid") ?? [];

  return (
    <div>
      <PageHeader
        title={c.name}
        description={[c.phone, c.address].filter(Boolean).join(" · ") || undefined}
        actions={<>
          {c.phone && <Button variant="outline" size="touch" asChild><a href={`tel:${c.phone}`}><Phone /> Call</a></Button>}
          <Button variant="outline" size="touch" onClick={() => setLogging(true)}><Repeat /> Containers</Button>
          <Button variant="outline" size="touch" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
        </>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Balance (utang)" value={peso(balance.data?.outstanding)} danger={Number(balance.data?.outstanding) > 0} />
        <Stat label="Unpaid orders" value={String(balance.data?.unpaid_orders ?? 0)} />
        <Stat label="Containers held" value={String(c.container_balance)} />
        <Stat label="Credit limit" value={c.credit_limit == null ? "None" : peso(c.credit_limit)} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground capitalize">
        {c.client_type} · {c.billing_cycle === "monthly_soa" ? "Monthly SOA" : "Pay per delivery"} · {c.payment_terms_days}-day terms
      </p>

      <Tabs defaultValue="unpaid">
        <TabsList className="h-11">
          <TabsTrigger value="unpaid">Unpaid ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          {isOwner && <TabsTrigger value="prices">Prices</TabsTrigger>}
        </TabsList>
        <TabsContent value="unpaid"><OrderList rows={unpaid} onOpen={setDetail} empty="No unpaid orders 🎉" /></TabsContent>
        <TabsContent value="orders"><OrderList rows={orders.data ?? []} onOpen={setDetail} empty="No orders yet." /></TabsContent>
        <TabsContent value="containers">
          {!logs.data?.length ? <Empty>No container movements yet.</Empty> : (
            <div className="flex flex-col divide-y rounded-xl border bg-card">
              {logs.data.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p>{dateTime(l.logged_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      Delivered {l.gallons_delivered} · Returned {l.gallons_pulled_out}{l.notes ? ` · ${l.notes}` : ""}
                    </p>
                  </div>
                  <span className={(l.net_change ?? 0) > 0 ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                    {(l.net_change ?? 0) > 0 ? "+" : ""}{l.net_change}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        {isOwner && <TabsContent value="prices"><ClientPrices clientId={id} /></TabsContent>}
      </Tabs>

      <EditClient client={c} isOwner={isOwner} open={editing} onOpenChange={setEditing} onSaved={client.reload} />
      <ContainerDialog clientId={id} open={logging} onOpenChange={setLogging} onSaved={reloadAll} />
      <OrderDetailDialog orderId={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card className="gap-1 py-3">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

type OrderRow = { id: string; order_no: number; created_at: string; status: string; payment_status: string; total_amount: number; amount_paid: number };

function OrderList({ rows, onOpen, empty }: { rows: OrderRow[]; onOpen: (id: string) => void; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="flex flex-col divide-y rounded-xl border bg-card">
      {rows.map((o) => (
        <button key={o.id} type="button" onClick={() => onOpen(o.id)} className="flex items-center justify-between gap-3 p-3 text-left hover:bg-muted">
          <div>
            <p className="font-medium">#{o.order_no}</p>
            <p className="text-xs text-muted-foreground">{dateTime(o.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-semibold">{peso(o.total_amount)}</span>
            <span className="flex gap-1">
              {o.status !== "completed" && <StatusBadge status={o.status} />}
              {o.status !== "voided" && <StatusBadge status={o.payment_status} />}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EditClient({ client, isOwner, open, onOpenChange, onSaved }: {
  client: Client; isOwner: boolean; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(client);
  const [limit, setLimit] = useState(client.credit_limit == null ? "" : String(client.credit_limit));
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(open);
  if (open !== last) {
    setLast(open);
    if (open) { setForm(client); setLimit(client.credit_limit == null ? "" : String(client.credit_limit)); }
  }
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    const patch: Partial<Client> = {
      name: form.name.trim(), phone: form.phone?.trim() || null, address: form.address?.trim() || null, notes: form.notes?.trim() || null,
    };
    if (isOwner) {
      Object.assign(patch, {
        client_type: form.client_type, billing_cycle: form.billing_cycle, payment_terms_days: Number(form.payment_terms_days) || 0,
        credit_limit: limit === "" ? null : Number(limit), is_active: form.is_active,
      });
    }
    const { error } = await createClient().from("clients").update(patch).eq("id", client.id);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Saved");
    onSaved();
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Edit client"
      footer={<Button size="touch" className="w-full" onClick={save} disabled={busy || !form.name.trim()}>Save</Button>}>
      <div className="flex flex-col gap-3">
        <Field label="Name" htmlFor="ec-name"><Input id="ec-name" className="h-11" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Phone" htmlFor="ec-phone"><Input id="ec-phone" type="tel" className="h-11" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Address" htmlFor="ec-addr"><Input id="ec-addr" className="h-11" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Notes" htmlFor="ec-notes"><Textarea id="ec-notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        {isOwner ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.client_type} onValueChange={(v) => set("client_type", v)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="retail">Retail</SelectItem><SelectItem value="commercial">Commercial</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Billing">
                <Select value={form.billing_cycle} onValueChange={(v) => set("billing_cycle", v)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="per_delivery">Per delivery</SelectItem><SelectItem value="monthly_soa">Monthly SOA</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Credit limit" hint="Empty = no limit">
                <MoneyInput value={limit} onChange={setLimit} placeholder="No limit" />
              </Field>
              <Field label="Terms (days)" htmlFor="ec-terms">
                <Input id="ec-terms" inputMode="numeric" className="h-12" value={String(form.payment_terms_days)}
                  onChange={(e) => set("payment_terms_days", Number(e.target.value.replace(/\D/g, "")))} />
              </Field>
            </div>
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">Active <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} /></label>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Credit limit, billing and terms can only be changed by the owner.</p>
        )}
      </div>
    </ResponsiveDialog>
  );
}

function ContainerDialog({ clientId, open, onOpenChange, onSaved }: {
  clientId: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [delivered, setDelivered] = useState("0");
  const [pulled, setPulled] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc("log_container_movement", {
      p_client_id: clientId, p_gallons_delivered: Number(delivered || 0), p_gallons_pulled_out: Number(pulled || 0), p_notes: notes,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Container movement saved");
    setDelivered("0"); setPulled("0"); setNotes("");
    onSaved();
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Log containers"
      description="For movements without a sale, e.g. client returns empties."
      footer={<Button size="touch" className="w-full" onClick={save} disabled={busy}>Save</Button>}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Given to client" htmlFor="cd-del"><Input id="cd-del" inputMode="numeric" className="h-11" value={delivered} onChange={(e) => setDelivered(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Returned by client" htmlFor="cd-pull"><Input id="cd-pull" inputMode="numeric" className="h-11" value={pulled} onChange={(e) => setPulled(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
        <Field label="Notes" htmlFor="cd-notes"><Input id="cd-notes" className="h-11" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </ResponsiveDialog>
  );
}

function ClientPrices({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const products = useData(() => supabase.from("products").select("id, name, unit_price").eq("is_active", true).order("sort_order"));
  const prices = useData(() => supabase.from("client_prices").select("product_id, price").eq("client_id", clientId), [clientId]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const current = new Map(prices.data?.map((p) => [p.product_id, String(p.price)]) ?? []);

  async function save(productId: string) {
    const v = edits[productId];
    if (v === undefined || v === "") return;
    const { error } = await supabase.from("client_prices")
      .upsert({ client_id: clientId, product_id: productId, price: Number(v), updated_at: new Date().toISOString() });
    if (error) return toast.error(errMsg(error));
    toast.success("Price saved");
    setEdits((e) => { const n = { ...e }; delete n[productId]; return n; });
    void prices.reload();
  }

  if (!products.data) return <Loading />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Custom prices</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">Leave a product at the base price by not setting it. New sales use these prices automatically.</p>
        {products.data.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <Row label="Base" className="justify-start gap-1 text-xs">{peso(p.unit_price)}</Row>
            </div>
            <div className="w-28"><MoneyInput value={edits[p.id] ?? current.get(p.id) ?? ""} onChange={(v) => setEdits((e) => ({ ...e, [p.id]: v }))} placeholder="Base" /></div>
            <Button size="touch" variant="secondary" disabled={edits[p.id] === undefined} onClick={() => save(p.id)}>Save</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
