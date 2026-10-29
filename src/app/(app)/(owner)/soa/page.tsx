"use client";

import Link from "next/link";
import { useState } from "react";
import { FilePlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { dateOnly, errMsg, manilaToday, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { ClientPicker, type ClientLite } from "@/components/client-picker";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Empty, Field, Loading, PageHeader, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function lastMonth() {
  const [y, m] = manilaToday().split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return [iso(new Date(Date.UTC(y, m - 2, 1))), iso(new Date(Date.UTC(y, m - 1, 0)))];
}

export default function SoaListPage() {
  const supabase = createClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [creating, setCreating] = useState(false);
  const q = useData(() => {
    const query = supabase.from("v_soas").select("*").order("generated_at", { ascending: false }).limit(200);
    return filter === "open" ? query.neq("status", "paid") : query;
  }, [filter]);

  return (
    <div>
      <PageHeader title="Statements of Account" description="Monthly billing for commercial / SOA clients"
        actions={<Button size="touch" onClick={() => setCreating(true)}><FilePlus /> Generate SOA</Button>} />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList className="h-11"><TabsTrigger value="open">Unpaid / overdue</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
      </Tabs>
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No statements.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((s) => (
            <Link key={s.id} href={`/soa/${s.id}`} className="flex flex-col gap-1 rounded-xl border bg-card p-4 hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">SOA #{s.soa_no} · {s.client_name}</p>
                <StatusBadge status={s.status ?? "unpaid"} />
              </div>
              <p className="text-sm text-muted-foreground">{dateOnly(s.period_start)} – {dateOnly(s.period_end)} · {s.total_deliveries} orders</p>
              <p className="text-sm">Due {dateOnly(s.due_date)} · Balance <span className="font-semibold">{peso(s.balance)}</span> of {peso(s.total_amount_due)}</p>
            </Link>
          ))}
        </div>
      )}
      <GenerateDialog open={creating} onOpenChange={setCreating} onCreated={q.reload} />
    </div>
  );
}

function GenerateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [client, setClient] = useState<ClientLite | null>(null);
  const [[start, end], setRange] = useState(lastMonth);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!client) return toast.error("Choose a client");
    setBusy(true);
    const { error } = await createClient().rpc("generate_soa", {
      p_client_id: client.id, p_period_start: start, p_period_end: end, p_due_date: due || undefined,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("SOA generated");
    onCreated();
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Generate SOA"
      description="Bills all completed, unpaid orders in the period that are not on another SOA yet."
      footer={<Button size="touch" className="w-full" onClick={generate} disabled={busy}>Generate</Button>}>
      <div className="flex flex-col gap-3">
        <Field label="Client"><ClientPicker value={client} onChange={setClient} allowNone={false} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" className="h-11" value={start} onChange={(e) => setRange([e.target.value, end])} /></Field>
          <Field label="To"><Input type="date" className="h-11" value={end} onChange={(e) => setRange([start, e.target.value])} /></Field>
        </div>
        <Field label="Due date" hint="Empty = period end + client's payment terms">
          <Input type="date" className="h-11" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
