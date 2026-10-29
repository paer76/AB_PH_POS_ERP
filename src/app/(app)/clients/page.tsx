"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { NewClientForm } from "@/components/client-picker";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Empty, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClientsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [owingOnly, setOwingOnly] = useState(false);
  const [adding, setAdding] = useState(false);

  const list = useData(() => {
    let query = supabase.from("v_client_balances").select("*").eq("is_active", true).order("name").limit(300);
    const term = q.trim().replace(/[%,()]/g, "");
    if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    if (owingOnly) query = query.gt("outstanding", 0);
    return query;
  }, [q, owingOnly]);
  useRealtime(["orders", "payments"], list.reload, 800);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Balances (utang) and containers held"
        actions={<Button size="touch" onClick={() => setAdding(true)}><UserPlus /> New client</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Search name or phone" className="h-11 sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><Switch checked={owingOnly} onCheckedChange={setOwingOnly} /> With balance only</label>
      </div>

      {list.loading && !list.data ? <Loading /> : !list.data?.length ? <Empty>No clients found.</Empty> : (
        <>
          <div className="flex flex-col gap-2 md:hidden">
            {list.data.map((c) => (
              <Link key={c.client_id} href={`/clients/${c.client_id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.phone ?? "—"} · {c.container_balance} containers</p>
                </div>
                <div className="text-right">
                  <p className={Number(c.outstanding) > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{peso(c.outstanding)}</p>
                  {c.client_type === "commercial" && <Badge variant="secondary">Commercial</Badge>}
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Containers</TableHead><TableHead className="text-right">Unpaid orders</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((c) => (
                  <TableRow key={c.client_id} className="cursor-pointer" onClick={() => router.push(`/clients/${c.client_id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell className="capitalize">{c.client_type}{c.billing_cycle === "monthly_soa" ? " · SOA" : ""}</TableCell>
                    <TableCell className="text-right">{c.container_balance}</TableCell>
                    <TableCell className="text-right">{c.unpaid_orders}</TableCell>
                    <TableCell className={`text-right ${Number(c.outstanding) > 0 ? "font-semibold text-destructive" : ""}`}>{peso(c.outstanding)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ResponsiveDialog open={adding} onOpenChange={setAdding} title="New client">
        <NewClientForm onCancel={() => setAdding(false)} onCreated={(c) => router.push(`/clients/${c.id}`)} />
      </ResponsiveDialog>
    </div>
  );
}
