"use client";

import { useState, useTransition } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { dateTime } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useProfile } from "@/components/profile-provider";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Empty, Field, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createStaff, listStaff, resetStaffPassword, setStaffActive, type StaffRow } from "./actions";

export default function StaffPage() {
  const me = useProfile();
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<StaffRow | null>(null);
  const [pending, start] = useTransition();

  const staff = useData(async () => {
    const r = await listStaff();
    return r.ok ? { data: r.data, error: null } : { data: null, error: { message: r.error } };
  });
  const rows = staff.data;
  const load = staff.reload;

  function toggle(row: StaffRow, active: boolean) {
    start(async () => {
      const r = await setStaffActive(row.id, active);
      if (!r.ok) toast.error(r.error); else { toast.success(active ? "Account enabled" : "Account disabled"); await load(); }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Staff accounts" description="Each person gets their own login so the audit log shows who did what."
        actions={<Button size="touch" onClick={() => setAdding(true)}><UserPlus /> Add staff</Button>} />
      {staff.error && <Empty>{staff.error}</Empty>}
      {!rows ? (staff.error ? null : <Loading />) : !rows.length ? <Empty>No staff.</Empty> : (
        <div className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">{r.full_name} <Badge variant="secondary" className="capitalize">{r.role}</Badge></p>
                <p className="truncate text-xs text-muted-foreground">{r.email} · last sign-in {dateTime(r.last_sign_in_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="touch" onClick={() => setResetFor(r)}><KeyRound /> Password</Button>
                {r.id !== me.id && (
                  <label className="flex items-center gap-2 text-sm">Active <Switch disabled={pending} checked={r.is_active} onCheckedChange={(v) => toggle(r, v)} /></label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <AddStaff open={adding} onOpenChange={setAdding} onCreated={load} />
      <ResetPassword row={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}

function AddStaff({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "secretary" as "owner" | "secretary" });
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await createStaff(f);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Account created for ${f.full_name}`);
      setF({ full_name: "", email: "", password: "", role: "secretary" });
      onCreated();
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Add staff account"
      description="Give them the email and password. They can sign in on any phone or tablet."
      footer={<Button size="touch" className="w-full" onClick={save} disabled={pending}>Create account</Button>}>
      <div className="flex flex-col gap-3">
        <Field label="Full name" htmlFor="s-name"><Input id="s-name" className="h-11" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="s-email"><Input id="s-email" type="email" className="h-11" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Temporary password" htmlFor="s-pass" hint="At least 8 characters, with a letter and a number">
          <Input id="s-pass" className="h-11" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as typeof f.role })}>
            <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="secretary">Secretary (counter)</SelectItem><SelectItem value="owner">Owner (full access)</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>
    </ResponsiveDialog>
  );
}

function ResetPassword({ row, onClose }: { row: StaffRow | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (!row) return;
    start(async () => {
      const r = await resetStaffPassword(row.id, password);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Password changed");
      setPassword("");
      onClose();
    });
  }

  return (
    <ResponsiveDialog open={!!row} onOpenChange={(o) => !o && onClose()} title={`New password · ${row?.full_name ?? ""}`}
      footer={<Button size="touch" className="w-full" onClick={save} disabled={pending || password.length < 8}>Set password</Button>}>
      <Field label="New password" htmlFor="rp" hint="At least 8 characters, with a letter and a number"><Input id="rp" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
    </ResponsiveDialog>
  );
}
