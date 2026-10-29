"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { dateTime, errMsg, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import type { ShiftSummary } from "@/hooks/use-shift";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { ShiftSummaryView } from "@/components/shift-summary-card";
import { MoneyInput } from "@/components/payment-fields";
import { Empty, Field, Loading, PageHeader, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ShiftsPage() {
  const supabase = createClient();
  const [open, setOpen] = useState<{ id: string; status: string; name: string } | null>(null);
  const q = useData(() =>
    supabase.from("shifts").select("*, profiles(full_name)").order("opened_at", { ascending: false }).limit(100));
  useRealtime(["shifts"], q.reload);

  return (
    <div>
      <PageHeader title="Shifts" description="Cash reconciliation per shift. Negative variance = drawer short." />
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No shifts yet.</Empty> : (
        <>
          <div className="flex flex-col gap-2 md:hidden">
            {q.data.map((s) => (
              <button key={s.id} type="button" onClick={() => setOpen({ id: s.id, status: s.status, name: s.profiles?.full_name ?? "" })}
                className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left">
                <div>
                  <p className="font-medium">{s.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(s.opened_at)}{s.closed_at ? ` → ${dateTime(s.closed_at)}` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={s.status} />
                  {s.variance != null && <span className={Number(s.variance) < 0 ? "text-sm text-destructive" : "text-sm"}>{peso(s.variance)}</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead><TableHead>Opened</TableHead><TableHead>Closed</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpen({ id: s.id, status: s.status, name: s.profiles?.full_name ?? "" })}>
                    <TableCell className="font-medium">{s.profiles?.full_name}</TableCell>
                    <TableCell>{dateTime(s.opened_at)}</TableCell>
                    <TableCell>{dateTime(s.closed_at)}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-right">{peso(s.opening_cash)}</TableCell>
                    <TableCell className="text-right">{s.expected_cash == null ? "—" : peso(s.expected_cash)}</TableCell>
                    <TableCell className="text-right">{s.closing_cash == null ? "—" : peso(s.closing_cash)}</TableCell>
                    <TableCell className={`text-right ${Number(s.variance) < 0 ? "text-destructive" : ""}`}>{s.variance == null ? "—" : peso(s.variance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <ShiftDialog shift={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function ShiftDialog({ shift, onClose }: { shift: { id: string; status: string; name: string } | null; onClose: () => void }) {
  const supabase = createClient();
  const summary = useData(async () => {
    if (!shift) return { data: null, error: null };
    return await supabase.rpc("shift_summary", { p_shift_id: shift.id });
  }, [shift?.id]);
  const [counted, setCounted] = useState("");

  async function forceClose() {
    if (!shift || counted === "") return toast.error("Enter the counted cash");
    const { error } = await supabase.rpc("close_shift", { p_shift_id: shift.id, p_closing_cash: Number(counted), p_notes: "Closed by owner" });
    if (error) return toast.error(errMsg(error));
    toast.success("Shift closed");
    onClose();
  }

  return (
    <ResponsiveDialog open={!!shift} onOpenChange={(o) => !o && onClose()} title={`Shift · ${shift?.name ?? ""}`}>
      {!summary.data ? <Loading /> : (
        <div className="flex flex-col gap-4">
          <ShiftSummaryView s={summary.data as unknown as ShiftSummary} />
          {shift?.status === "open" && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Field label="Close this shift for them (counted cash)"><MoneyInput value={counted} onChange={setCounted} /></Field>
              <Button variant="destructive" size="touch" onClick={forceClose}>Close shift</Button>
            </div>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
