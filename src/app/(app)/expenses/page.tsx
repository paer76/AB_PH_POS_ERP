"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errMsg, peso, time } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { useMyShift } from "@/hooks/use-shift";
import { MoneyInput } from "@/components/payment-fields";
import { Empty, Field, Loading, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPES = [
  { value: "expense", label: "Expense (paid from drawer)" },
  { value: "cash_out", label: "Cash out (e.g. owner pick-up)" },
  { value: "cash_in", label: "Cash in (e.g. added change)" },
] as const;
const CATEGORIES = ["Fuel", "Supplies", "Caps & seals", "Repairs", "Food", "Utilities", "Other"];

export default function ExpensesPage() {
  const supabase = createClient();
  const { shift, loading } = useMyShift();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Fuel");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useData(
    async () => {
      if (!shift) return { data: [], error: null };
      return await supabase.from("cash_movements").select("*").eq("shift_id", shift.id).order("created_at", { ascending: false });
    },
    [shift?.id],
  );
  useRealtime(["cash_movements"], list.reload);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("log_cash_movement", {
      p_type: type, p_amount: Number(amount), p_description: description,
      p_category: type === "expense" ? category : undefined,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Saved");
    setAmount("");
    setDescription("");
  }

  if (loading) return <Loading />;
  if (!shift) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Expenses & cash" />
        <Empty>Open a shift first. <Link className="text-primary underline" href="/shift">Go to Shift</Link></Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><PageHeader title="Expenses & cash" description="Anything taken from or added to the drawer during this shift." /></div>
      <Card>
        <CardHeader><CardTitle>Log cash movement</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {type === "expense" && (
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Amount" htmlFor="cm-amt"><MoneyInput id="cm-amt" value={amount} onChange={setAmount} /></Field>
          <Field label="Description" htmlFor="cm-desc">
            <Input id="cm-desc" className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Gas for tricycle" />
          </Field>
          <Button size="touch" onClick={save} disabled={busy || !Number(amount) || !description.trim()}>Save</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>This shift</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {!list.data?.length ? <p className="text-sm text-muted-foreground">Nothing logged yet.</p> : list.data.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.description}</p>
                <p className="text-xs text-muted-foreground">{time(m.created_at)} · {m.type.replace("_", " ")}{m.category ? ` · ${m.category}` : ""}</p>
              </div>
              <span className={m.type === "cash_in" ? "text-emerald-600" : "text-destructive"}>
                {m.type === "cash_in" ? "+" : "−"}{peso(m.amount)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
