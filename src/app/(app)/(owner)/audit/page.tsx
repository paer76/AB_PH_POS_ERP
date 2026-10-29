"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";
import { dateTime } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { Empty, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TABLES = ["all", "orders", "payments", "products", "client_prices", "clients", "shifts", "cash_movements",
  "container_logs", "void_requests", "monthly_soas", "profiles", "riders"];
const NOISE = new Set(["created_at", "updated_at"]);
const PAGE = 50;

function changes(oldData: Json, newData: Json) {
  const o = (oldData ?? {}) as Record<string, unknown>;
  const n = (newData ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => !NOISE.has(k));
  return keys
    .filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ k, from: o[k], to: n[k] }));
}

const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default function AuditPage() {
  const supabase = createClient();
  const [table, setTable] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const people = useData(() => supabase.from("profiles").select("id, full_name"));
  const names = new Map(people.data?.map((p) => [p.id, p.full_name]) ?? []);

  const q = useData(() => {
    let query = supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(limit);
    if (table !== "all") query = query.eq("table_name", table);
    return query;
  }, [table, limit]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Audit log" description="Every change to sales, payments, prices and accounts. Read-only."
        actions={
          <Select value={table} onValueChange={(v) => { setTable(v); setLimit(PAGE); }}>
            <SelectTrigger className="h-11 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{TABLES.map((t) => <SelectItem key={t} value={t}>{t === "all" ? "All tables" : t.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        } />
      {q.loading && !q.data ? <Loading /> : !q.data?.length ? <Empty>No entries.</Empty> : (
        <div className="flex flex-col gap-2">
          {q.data.map((e) => {
            const diff = e.action === "UPDATE" ? changes(e.old_data, e.new_data) : [];
            return (
              <div key={e.id} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={e.action === "DELETE" ? "destructive" : "secondary"}>{e.action}</Badge>
                  <span className="font-medium">{e.table_name}</span>
                  <span className="text-muted-foreground">by {e.actor_id ? names.get(e.actor_id) ?? "unknown" : "system"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{dateTime(e.at)}</span>
                </div>
                {diff.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5 font-mono text-xs break-all">
                    {diff.map((d) => <li key={d.k}><span className="text-muted-foreground">{d.k}:</span> {show(d.from)} → <b>{show(d.to)}</b></li>)}
                  </ul>
                )}
                {e.action === "INSERT" && (
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{show(e.new_data)}</p>
                )}
              </div>
            );
          })}
          {q.data.length >= limit && <Button variant="outline" size="touch" onClick={() => setLimit((l) => l + PAGE)}>Load more</Button>}
        </div>
      )}
    </div>
  );
}
