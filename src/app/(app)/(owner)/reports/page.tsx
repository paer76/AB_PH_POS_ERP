"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { dateOnly, manilaToday, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { Empty, Loading, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const chartConfig = { sales: { label: "Sales", color: "var(--chart-1)" } } satisfies ChartConfig;

function monthRange(offset: number) {
  const [y, m] = manilaToday().split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 + offset, 1));
  const end = new Date(Date.UTC(y, m + offset, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const endStr = offset === 0 ? manilaToday() : iso(end);
  return [iso(start), endStr] as const;
}

const PRESETS = [
  { label: "This month", range: () => monthRange(0) },
  { label: "Last month", range: () => monthRange(-1) },
  { label: "Last 7 days", range: () => [manilaToday(-6), manilaToday()] as const },
  { label: "Last 90 days", range: () => [manilaToday(-89), manilaToday()] as const },
];

export default function ReportsPage() {
  const supabase = createClient();
  const [[start, end], setRange] = useState<readonly [string, string]>(monthRange(0));

  const daily = useData(() => supabase.rpc("sales_report", { p_start: start, p_end: end }), [start, end]);
  const clients = useData(() => supabase.rpc("client_volume_report", { p_start: start, p_end: end }), [start, end]);

  const rows = daily.data ?? [];
  const totals = rows.reduce(
    (t, r) => ({ sales: t.sales + Number(r.sales), collected: t.collected + Number(r.collected), orders: t.orders + Number(r.orders), refills: t.refills + Number(r.refills), expenses: t.expenses + Number(r.expenses) }),
    { sales: 0, collected: 0, orders: 0, refills: 0, expenses: 0 },
  );
  const chartData = rows.map((r) => ({ ...r, sales: Number(r.sales), label: r.day.slice(5) }));

  function exportCsv() {
    const header = "date,sales,collected,orders,refills,expenses";
    const body = rows.map((r) => [r.day, r.sales, r.collected, r.orders, r.refills, r.expenses].join(","));
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aqua-best-sales_${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title="Reports" description={`${dateOnly(start)} – ${dateOnly(end)}`}
        actions={<Button variant="outline" size="touch" onClick={exportCsv} disabled={!rows.length}><Download /> CSV</Button>} />

      {/* Filters: one row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const [a, b] = p.range();
          return <Button key={p.label} size="sm" variant={a === start && b === end ? "default" : "outline"} onClick={() => setRange([a, b])}>{p.label}</Button>;
        })}
        <Input type="date" className="h-9 w-40" value={start} max={end} onChange={(e) => e.target.value && setRange([e.target.value, end])} />
        <span className="text-muted-foreground">to</span>
        <Input type="date" className="h-9 w-40" value={end} min={start} max={manilaToday()} onChange={(e) => e.target.value && setRange([start, e.target.value])} />
      </div>

      {daily.error && <Empty>{daily.error}</Empty>}
      {daily.loading && !daily.data ? <Loading /> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Total label="Sales" value={peso(totals.sales)} />
            <Total label="Collected" value={peso(totals.collected)} />
            <Total label="Orders" value={String(totals.orders)} />
            <Total label="Refills" value={String(totals.refills)} />
            <Total label="Expenses" value={peso(totals.expenses)} />
          </div>

          <Card>
            <CardHeader><CardTitle>Daily sales</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="chart">
                <TabsList><TabsTrigger value="chart">Chart</TabsTrigger><TabsTrigger value="table">Table</TabsTrigger></TabsList>
                <TabsContent value="chart">
                  <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full md:h-80">
                    <BarChart data={chartData} margin={{ left: 4, right: 4 }} barCategoryGap={2}>
                      <CartesianGrid vertical={false} strokeOpacity={0.4} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} width={48} fontSize={11}
                        tickFormatter={(v: number) => (v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`)} />
                      <ChartTooltip cursor={{ fillOpacity: 0.15 }}
                        content={<ChartTooltipContent labelFormatter={(_, p) => dateOnly(p?.[0]?.payload?.day)}
                          formatter={(v) => <span className="font-medium">Sales {peso(Number(v))}</span>} />} />
                      <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </TabsContent>
                <TabsContent value="table">
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-card">Date</TableHead><TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Refills</TableHead><TableHead className="text-right">Expenses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.day}>
                            <TableCell className="sticky left-0 bg-card">{dateOnly(r.day)}</TableCell>
                            <TableCell className="text-right">{peso(r.sales)}</TableCell>
                            <TableCell className="text-right">{peso(r.collected)}</TableCell>
                            <TableCell className="text-right">{r.orders}</TableCell>
                            <TableCell className="text-right">{r.refills}</TableCell>
                            <TableCell className="text-right">{peso(r.expenses)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Clients by volume</CardTitle></CardHeader>
            <CardContent>
              {!clients.data?.length ? <p className="text-sm text-muted-foreground">No client orders in this range.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card">Client</TableHead><TableHead>Type</TableHead>
                        <TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Refills</TableHead>
                        <TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Balance now</TableHead>
                        <TableHead className="text-right">Containers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.data.map((c) => (
                        <TableRow key={c.client_id}>
                          <TableCell className="sticky left-0 bg-card font-medium">{c.name}</TableCell>
                          <TableCell className="capitalize">{c.client_type}</TableCell>
                          <TableCell className="text-right">{c.orders}</TableCell>
                          <TableCell className="text-right">{c.refills}</TableCell>
                          <TableCell className="text-right">{peso(c.sales)}</TableCell>
                          <TableCell className={`text-right ${Number(c.outstanding) > 0 ? "text-destructive" : ""}`}>{peso(c.outstanding)}</TableCell>
                          <TableCell className="text-right">{c.container_balance}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 py-3">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
