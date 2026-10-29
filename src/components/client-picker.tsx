"use client";

import { useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";
import { errMsg, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Empty, Field, Loading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ClientLite = Pick<
  Tables<"clients">,
  "id" | "name" | "phone" | "address" | "client_type" | "billing_cycle" | "credit_limit" | "container_balance"
>;

const CLIENT_COLS = "id, name, phone, address, client_type, billing_cycle, credit_limit, container_balance";

export function ClientPicker({
  value, onChange, allowNone = true,
}: { value: ClientLite | null; onChange: (c: ClientLite | null) => void; allowNone?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const supabase = createClient();

  const list = useData(() => {
    let query = supabase.from("clients").select(CLIENT_COLS).eq("is_active", true).order("name").limit(40);
    const term = q.trim().replace(/[%,()]/g, "");
    if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    return query;
  }, [q, open]);

  function pick(c: ClientLite | null) {
    onChange(c);
    setOpen(false);
    setQ("");
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="touch" className="flex-1 justify-start truncate" onClick={() => setOpen(true)}>
          <Search />
          <span className="truncate">{value ? value.name : allowNone ? "Walk-in (no client)" : "Choose client"}</span>
          {value?.client_type === "commercial" && <Badge variant="secondary" className="ml-auto">Commercial</Badge>}
        </Button>
        {value && allowNone && (
          <Button variant="ghost" size="icon-touch" aria-label="Clear client" onClick={() => onChange(null)}>
            <X />
          </Button>
        )}
      </div>

      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Choose client">
        {adding ? (
          <NewClientForm
            initialName={q}
            onCancel={() => setAdding(false)}
            onCreated={(c) => { setAdding(false); pick(c); }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Input autoFocus placeholder="Search name or phone" className="h-11 text-base" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex gap-2">
              {allowNone && <Button variant="secondary" className="flex-1" size="touch" onClick={() => pick(null)}>Walk-in (no client)</Button>}
              <Button variant="outline" className="flex-1" size="touch" onClick={() => setAdding(true)}><UserPlus /> New client</Button>
            </div>
            <div className="flex max-h-[50dvh] flex-col divide-y overflow-y-auto rounded-lg border">
              {list.loading && !list.data ? <Loading /> : list.data?.length ? list.data.map((c) => (
                <button key={c.id} type="button" onClick={() => pick(c)} className="flex min-h-14 flex-col items-start px-3 py-2 text-left hover:bg-muted">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[c.phone, c.address].filter(Boolean).join(" · ") || "No contact info"}
                    {c.client_type === "commercial" ? " · Commercial" : ""}
                  </span>
                </button>
              )) : <Empty>No clients found</Empty>}
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </>
  );
}

export function NewClientForm({
  initialName = "", onCreated, onCancel,
}: { initialName?: string; onCreated: (c: ClientLite) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    const { data, error } = await createClient()
      .from("clients")
      .insert({ name: name.trim(), phone: phone.trim() || null, address: address.trim() || null })
      .select(CLIENT_COLS)
      .single();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(`Added ${data.name}`);
    onCreated(data);
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Name" htmlFor="nc-name"><Input id="nc-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Phone" htmlFor="nc-phone"><Input id="nc-phone" type="tel" inputMode="tel" className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label="Address" htmlFor="nc-addr"><Input id="nc-addr" className="h-11" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button variant="outline" size="touch" className="flex-1" onClick={onCancel}>Back</Button>
        <Button size="touch" className="flex-1" onClick={save} disabled={busy}>Save client</Button>
      </div>
    </div>
  );
}

export function creditText(c: ClientLite) {
  return c.credit_limit == null ? "No credit limit" : `Credit limit ${peso(c.credit_limit)}`;
}
