"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errMsg, peso, dateTime } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { useMyShift, type ShiftSummary } from "@/hooks/use-shift";
import { useProfile } from "@/components/profile-provider";
import { Field, Loading, PageHeader, StatusBadge } from "@/components/common";
import { ShiftSummaryView } from "@/components/shift-summary-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ShiftPage() {
  const { shift, loading, reload } = useMyShift();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Shift" description="Open your shift before selling; count the drawer when you close." />
      {loading ? <Loading /> : shift ? <OpenShift shiftId={shift.id} onClosed={reload} /> : <OpenForm onOpened={reload} />}
      <RecentShifts />
    </div>
  );
}

function OpenForm({ onOpened }: { onOpened: () => void }) {
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const { error } = await createClient().rpc("open_shift", { p_opening_cash: Number(cash || 0) });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Shift opened");
    onOpened();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Open a shift</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Opening cash (float in the drawer)" htmlFor="open-cash">
          <Input id="open-cash" inputMode="decimal" placeholder="0.00" className="h-12 text-lg"
            value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Button size="touch" onClick={open} disabled={busy}>Open shift</Button>
      </CardContent>
    </Card>
  );
}

function OpenShift({ shiftId, onClosed }: { shiftId: string; onClosed: () => void }) {
  const supabase = createClient();
  const summary = useData(() => supabase.rpc("shift_summary", { p_shift_id: shiftId }), [shiftId]);
  useRealtime(["orders", "payments", "cash_movements"], summary.reload);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const s = summary.data as ShiftSummary | null;
  const diff = s && counted !== "" ? Number(counted) - Number(s.expected_cash) : null;

  async function close() {
    if (counted === "") return toast.error("Enter the cash you counted");
    setBusy(true);
    const { error } = await supabase.rpc("close_shift", {
      p_shift_id: shiftId, p_closing_cash: Number(counted), p_notes: notes,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Shift closed");
    onClosed();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Current shift</CardTitle></CardHeader>
        <CardContent>{s ? <ShiftSummaryView s={s} /> : <Loading />}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Close shift</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Cash counted in drawer" htmlFor="close-cash">
            <Input id="close-cash" inputMode="decimal" placeholder="0.00" className="h-12 text-lg"
              value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          {diff != null && (
            <p className={diff === 0 ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
              {diff === 0 ? "Drawer matches." : diff < 0 ? `Short by ${peso(-diff)}` : `Over by ${peso(diff)}`}
            </p>
          )}
          <Field label="Notes (optional)" htmlFor="close-notes">
            <Textarea id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain any short/over" />
          </Field>
          <Button size="touch" variant="destructive" onClick={close} disabled={busy}>Close shift</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RecentShifts() {
  const { id } = useProfile();
  const q = useData(
    () => createClient().from("shifts").select("*").eq("secretary_id", id).eq("status", "closed")
      .order("opened_at", { ascending: false }).limit(10),
    [id],
  );
  useRealtime(["shifts"], q.reload);
  if (!q.data?.length) return null;
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>My recent shifts</CardTitle></CardHeader>
      <CardContent className="flex flex-col divide-y">
        {q.data.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div>
              <p className="font-medium">{dateTime(s.opened_at)} → {dateTime(s.closed_at)}</p>
              <p className="text-muted-foreground">Expected {peso(s.expected_cash)} · Counted {peso(s.closing_cash)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={Number(s.variance) < 0 ? "text-destructive" : ""}>{peso(s.variance)}</span>
              <StatusBadge status={s.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
