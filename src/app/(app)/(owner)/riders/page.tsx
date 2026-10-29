"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { Empty, Loading, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function RidersPage() {
  const supabase = createClient();
  const q = useData(() => supabase.from("riders").select("*").order("is_active", { ascending: false }).order("name"));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("riders").insert({ name: name.trim(), phone: phone.trim() || null });
    if (error) return toast.error(errMsg(error));
    setName(""); setPhone("");
    void q.reload();
  }

  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("riders").update({ is_active }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    void q.reload();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Delivery riders" description="Riders don't log in; staff pick them when dispatching." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input className="h-11" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="h-11" type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button size="touch" onClick={add} disabled={!name.trim()}><Plus /> Add</Button>
      </div>
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No riders yet.</Empty> : (
        <div className="flex flex-col divide-y rounded-xl border bg-card">
          {q.data.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className={r.is_active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.phone ?? "—"}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">Active <Switch checked={r.is_active} onCheckedChange={(v) => toggle(r.id, v)} /></label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
