"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2, Truck, Store } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { errMsg, peso, type PaymentMethod } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useMyShift } from "@/hooks/use-shift";
import { ClientPicker, creditText, type ClientLite } from "@/components/client-picker";
import { MethodSelect, MoneyInput, ReferenceField } from "@/components/payment-fields";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Field, Loading, Row } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

type OrderType = "walk_in" | "delivery";

export default function PosPage() {
  const supabase = createClient();
  const router = useRouter();
  const { shift, loading: shiftLoading } = useMyShift();

  const products = useData(
    () => supabase.from("products").select("id, name, category, unit_price, track_stock, stock_quantity")
      .eq("is_active", true).order("sort_order").order("name"),
  );
  const [client, setClient] = useState<ClientLite | null>(null);
  const prices = useData(
    async () => {
      if (!client) return { data: [], error: null };
      return await supabase.from("client_prices").select("product_id, price").eq("client_id", client.id);
    },
    [client?.id],
  );
  const [orderType, setOrderType] = useState<OrderType>("walk_in");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const priceMap = useMemo(() => new Map(prices.data?.map((p) => [p.product_id, Number(p.price)]) ?? []), [prices.data]);
  const priceOf = (id: string, base: number) => priceMap.get(id) ?? Number(base);

  const lines = useMemo(() => (products.data ?? [])
    .filter((p) => cart[p.id])
    .map((p) => ({ ...p, qty: cart[p.id], price: priceOf(p.id, p.unit_price) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [products.data, cart, priceMap]);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const refillQty = lines.filter((l) => l.category === "refill").reduce((s, l) => s + l.qty, 0);

  const add = (id: string, d = 1) => setCart((c) => {
    const n = (c[id] ?? 0) + d;
    const next = { ...c };
    if (n <= 0) delete next[id]; else next[id] = n;
    return next;
  });

  function reset() {
    setCart({});
    setClient(null);
    setOrderType("walk_in");
    setCheckoutOpen(false);
    setCartOpen(false);
  }

  if (shiftLoading) return <Loading />;
  if (!shift) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-lg font-medium">Open your shift to start selling</p>
          <Button size="touch" asChild><Link href="/shift">Go to Shift</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const cartPanel = (
    <CartPanel
      lines={lines} total={total} client={client} orderType={orderType}
      onAdd={add} onClear={() => setCart({})}
      onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-6">
      {/* bottom padding keeps the last product row clear of the floating cart bar */}
      <div className={cn("flex flex-col gap-4 lg:pb-0", itemCount > 0 && "pb-20")}>
        {/* Order type + client */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-72">
            {([["walk_in", "Walk-in", Store], ["delivery", "Delivery", Truck]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" onClick={() => setOrderType(v)}
                className={cn("flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium",
                  orderType === v ? "bg-background shadow-sm" : "text-muted-foreground")}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <div className="flex-1"><ClientPicker value={client} onChange={setClient} allowNone={orderType === "walk_in"} /></div>
        </div>
        {client && (
          <p className="-mt-2 text-xs text-muted-foreground">
            {creditText(client)} · Holding {client.container_balance} of our containers
            {client.billing_cycle === "monthly_soa" ? " · Billed monthly (SOA)" : ""}
          </p>
        )}

        {/* Product grid */}
        {products.loading && !products.data ? <Loading /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.data?.map((p) => {
              const qty = cart[p.id] ?? 0;
              const price = priceOf(p.id, p.unit_price);
              return (
                <button key={p.id} type="button" onClick={() => add(p.id)}
                  className={cn("relative flex min-h-28 flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-xs transition active:scale-[0.98]",
                    qty > 0 && "border-primary ring-2 ring-primary/30")}>
                  <span className="font-medium leading-tight">{p.name}</span>
                  <span className="mt-2 flex items-end justify-between">
                    <span className="text-lg font-semibold text-primary">{peso(price)}</span>
                    {p.track_stock && <span className={cn("text-xs", p.stock_quantity <= 5 ? "text-destructive" : "text-muted-foreground")}>{p.stock_quantity} left</span>}
                  </span>
                  {priceMap.has(p.id) && <span className="text-[10px] text-muted-foreground">Client price</span>}
                  {qty > 0 && (
                    <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{qty}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart: side panel on large tablets/desktop */}
      <aside className="sticky top-6 hidden h-fit lg:block">
        <Card><CardContent>{cartPanel}</CardContent></Card>
      </aside>

      {/* Cart bar: phones & portrait tablets */}
      {itemCount > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4 md:left-64 lg:hidden">
          <Button size="touch" className="h-14 w-full justify-between text-base shadow-lg" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2"><ShoppingCart /> {itemCount} item{itemCount > 1 ? "s" : ""}</span>
            <span>{peso(total)} · Review</span>
          </Button>
        </div>
      )}
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left"><DrawerTitle>Cart</DrawerTitle></DrawerHeader>
          <div className="overflow-y-auto px-4 pb-safe pb-4">{cartPanel}</div>
        </DrawerContent>
      </Drawer>

      <Checkout
        open={checkoutOpen} onOpenChange={setCheckoutOpen}
        orderType={orderType} client={client} lines={lines} total={total} refillQty={refillQty}
        onDone={(orderNo) => {
          reset();
          toast.success(`Order #${orderNo} saved`, {
            action: { label: "Receipt", onClick: () => router.push(`/receipt/${orderNo}`) },
          });
        }}
      />
    </div>
  );
}

type Line = { id: string; name: string; qty: number; price: number; category: string };

function CartPanel({ lines, total, client, orderType, onAdd, onClear, onCheckout }: {
  lines: Line[]; total: number; client: ClientLite | null; orderType: OrderType;
  onAdd: (id: string, d: number) => void; onClear: () => void; onCheckout: () => void;
}) {
  const needsClient = orderType === "delivery" && !client;
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden items-center justify-between lg:flex">
        <h2 className="font-semibold">Cart</h2>
        {lines.length > 0 && <Button variant="ghost" size="sm" onClick={onClear}><Trash2 /> Clear</Button>}
      </div>
      {lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tap products to add them</p>
      ) : lines.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{l.name}</p>
            <p className="text-xs text-muted-foreground">{peso(l.price)} × {l.qty} = {peso(l.price * l.qty)}</p>
          </div>
          <Button variant="outline" size="icon-touch" aria-label="Less" onClick={() => onAdd(l.id, -1)}><Minus /></Button>
          <span className="w-8 text-center font-semibold tabular-nums">{l.qty}</span>
          <Button variant="outline" size="icon-touch" aria-label="More" onClick={() => onAdd(l.id, 1)}><Plus /></Button>
        </div>
      ))}
      <Separator />
      <Row label="Total" className="text-lg">{peso(total)}</Row>
      {needsClient && <p className="text-xs text-destructive">Choose a client for deliveries.</p>}
      <Button size="touch" className="h-12" disabled={!lines.length || needsClient} onClick={onCheckout}>
        {orderType === "delivery" ? "Continue to delivery" : "Checkout"}
      </Button>
    </div>
  );
}

function Checkout({ open, onOpenChange, orderType, client, lines, total, refillQty, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; orderType: OrderType; client: ClientLite | null;
  lines: Line[]; total: number; refillQty: number; onDone: (orderNo: number) => void;
}) {
  const supabase = createClient();
  const riders = useData(() => supabase.from("riders").select("id, name").eq("is_active", true).order("name"));
  const [tendered, setTendered] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [payLater, setPayLater] = useState(false);
  const [riderId, setRiderId] = useState<string>("none");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [delivered, setDelivered] = useState("0");
  const [pulled, setPulled] = useState("0");
  const [busy, setBusy] = useState(false);

  // Reset fields each time the dialog opens
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTendered("");
      setMethod("cash");
      setReference("");
      setPayLater(client?.billing_cycle === "monthly_soa");
      setRiderId("none");
      setAddress(client?.address ?? "");
      setNotes("");
      setDelivered("0");
      setPulled("0");
    }
  }

  const tenderedNum = Number(tendered || 0);
  const applied = payLater ? 0 : Math.min(method === "cash" ? tenderedNum : tenderedNum || total, total);
  const change = !payLater && method === "cash" ? Math.max(tenderedNum - total, 0) : 0;
  const balance = total - applied;

  async function submit() {
    if (!payLater && method === "cash" && tenderedNum < total && !client) {
      return toast.error("Not enough cash. Pick a client to record the balance as utang.");
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_order", {
      p_order_type: orderType,
      p_items: lines.map((l) => ({ product_id: l.id, quantity: l.qty })),
      p_client_id: client?.id,
      p_payment_amount: applied,
      p_payment_method: method,
      p_payment_reference: reference,
      p_gallons_delivered: orderType === "walk_in" ? Number(delivered || 0) : 0,
      p_gallons_pulled_out: orderType === "walk_in" ? Number(pulled || 0) : 0,
      p_rider_id: riderId === "none" ? undefined : riderId,
      p_delivery_address: address,
      p_notes: notes,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    onDone((data as { order_no: number }).order_no);
  }

  return (
    <ResponsiveDialog
      open={open} onOpenChange={onOpenChange}
      title={orderType === "delivery" ? "New delivery" : "Checkout"}
      description={`${client?.name ?? "Walk-in customer"} · ${peso(total)}`}
      footer={<Button size="touch" className="h-12 w-full" disabled={busy} onClick={submit}>
        {payLater ? "Save as unpaid" : balance > 0 ? `Save (${peso(balance)} utang)` : "Complete sale"}
      </Button>}
    >
      <div className="flex flex-col gap-4">
        {orderType === "delivery" && (
          <>
            <Field label="Delivery address" htmlFor="addr">
              <Input id="addr" className="h-11" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Rider (can be set later)">
              <Select value={riderId} onValueChange={setRiderId}>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned yet</SelectItem>
                  {riders.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {client && (
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm">
              <span className="font-medium">Pay later (utang{client.billing_cycle === "monthly_soa" ? " / SOA" : ""})</span>
              <span className="block text-xs text-muted-foreground">{creditText(client)}</span>
            </span>
            <Switch checked={payLater} onCheckedChange={setPayLater} />
          </label>
        )}

        {!payLater && (
          <>
            <Field label="Payment method"><MethodSelect value={method} onChange={setMethod} /></Field>
            <Field label={method === "cash" ? "Cash received" : "Amount paid"} htmlFor="tendered"
              hint={method !== "cash" && !tendered ? "Leave empty to pay the full amount" : undefined}>
              <MoneyInput id="tendered" value={tendered} onChange={setTendered} placeholder={peso(total)} />
            </Field>
            {method === "cash" && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setTendered(String(total))}>Exact</Button>
                {[50, 100, 200, 500, 1000].filter((v) => v >= total * 0.5).map((v) => (
                  <Button key={v} variant="secondary" onClick={() => setTendered(String(v))}>₱{v}</Button>
                ))}
              </div>
            )}
            <ReferenceField method={method} value={reference} onChange={setReference} />
          </>
        )}

        {orderType === "walk_in" && client && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Our gallons taken" htmlFor="del" hint="Station containers leaving with client">
              <Input id="del" inputMode="numeric" className="h-11" value={delivered} onChange={(e) => setDelivered(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Empties returned" htmlFor="pull" hint="Our containers brought back">
              <Input id="pull" inputMode="numeric" className="h-11" value={pulled} onChange={(e) => setPulled(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
        )}
        {orderType === "delivery" && refillQty > 0 && (
          <p className="text-xs text-muted-foreground">Gallons delivered / empties pulled out are recorded when the delivery is completed.</p>
        )}

        <Field label="Notes (optional)" htmlFor="notes">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
          <Row label="Total">{peso(total)}</Row>
          <Row label="Paid now">{peso(applied)}</Row>
          {change > 0 && <Row label="Change" className="text-base text-emerald-700 dark:text-emerald-400">{peso(change)}</Row>}
          {balance > 0 && <Row label="Balance (utang)" className="text-destructive">{peso(balance)}</Row>}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
