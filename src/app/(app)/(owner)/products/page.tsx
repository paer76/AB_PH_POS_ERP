"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";
import { errMsg, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { MoneyInput } from "@/components/payment-fields";
import { Empty, Field, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Product = Tables<"products">;
const EMPTY = { name: "", category: "refill", unit_price: "", track_stock: false, stock_quantity: "0", sort_order: "0", is_active: true };

export default function ProductsPage() {
  const supabase = createClient();
  const q = useData(() => supabase.from("products").select("*").order("is_active", { ascending: false }).order("sort_order").order("name"));
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Products & prices" description="Price changes apply to new sales only; past orders keep the price they were sold at."
        actions={<Button size="touch" onClick={() => setEditing("new")}><Plus /> Add product</Button>} />
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No products.</Empty> : (
        <div className="flex flex-col divide-y rounded-xl border bg-card">
          {q.data.map((p) => (
            <button key={p.id} type="button" onClick={() => setEditing(p)} className="flex items-center justify-between gap-3 p-3 text-left hover:bg-muted">
              <div className="min-w-0">
                <p className={`truncate font-medium ${p.is_active ? "" : "text-muted-foreground line-through"}`}>{p.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {p.category}{p.track_stock ? ` · ${p.stock_quantity} in stock` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {p.track_stock && p.stock_quantity <= 5 && <Badge variant="destructive">Low stock</Badge>}
                <span className="font-semibold">{peso(p.unit_price)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <ProductDialog product={editing} onClose={() => setEditing(null)} onSaved={q.reload} />
    </div>
  );
}

function ProductDialog({ product, onClose, onSaved }: { product: Product | "new" | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<typeof product>(null);
  if (product !== last) {
    setLast(product);
    if (product === "new") setF(EMPTY);
    else if (product) setF({
      name: product.name, category: product.category, unit_price: String(product.unit_price), track_stock: product.track_stock,
      stock_quantity: String(product.stock_quantity), sort_order: String(product.sort_order), is_active: product.is_active,
    });
  }
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!f.name.trim() || f.unit_price === "") return toast.error("Name and price are required");
    setBusy(true);
    const row = {
      name: f.name.trim(), category: f.category, unit_price: Number(f.unit_price), track_stock: f.track_stock,
      stock_quantity: Number(f.stock_quantity || 0), sort_order: Number(f.sort_order || 0), is_active: f.is_active,
    };
    const supabase = createClient();
    const { error } = product === "new"
      ? await supabase.from("products").insert(row)
      : await supabase.from("products").update(row).eq("id", (product as Product).id);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Saved");
    onSaved();
    onClose();
  }

  return (
    <ResponsiveDialog open={!!product} onOpenChange={(o) => !o && onClose()} title={product === "new" ? "Add product" : "Edit product"}
      footer={<Button size="touch" className="w-full" onClick={save} disabled={busy}>Save</Button>}>
      <div className="flex flex-col gap-3">
        <Field label="Name" htmlFor="p-name"><Input id="p-name" className="h-11" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={f.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="refill">Refill</SelectItem><SelectItem value="container">Container</SelectItem><SelectItem value="accessory">Accessory</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Price"><MoneyInput value={f.unit_price} onChange={(v) => set("unit_price", v)} /></Field>
        </div>
        <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <span>Track stock <span className="block text-xs text-muted-foreground">For containers, caps, seals — not refills</span></span>
          <Switch checked={f.track_stock} onCheckedChange={(v) => set("track_stock", v)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {f.track_stock && (
            <Field label="Stock on hand" htmlFor="p-stock" hint="Edit to correct a physical count">
              <Input id="p-stock" inputMode="numeric" className="h-11" value={f.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value.replace(/[^\d-]/g, ""))} />
            </Field>
          )}
          <Field label="Display order" htmlFor="p-sort" hint="Lower shows first on POS">
            <Input id="p-sort" inputMode="numeric" className="h-11" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
          Active (shown on POS) <Switch checked={f.is_active} onCheckedChange={(v) => set("is_active", v)} />
        </label>
      </div>
    </ResponsiveDialog>
  );
}
