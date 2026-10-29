"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { dateOnly, dateTime, errMsg, peso, type PaymentMethod } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { MethodSelect, MoneyInput, ReferenceField } from "@/components/payment-fields";
import { Empty, Field, Loading, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";

export default function SoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [paying, setPaying] = useState(false);

  const soa = useData(() => supabase.from("v_soas").select("*").eq("id", id).single(), [id]);
  const client = useData(async () => {
    if (!soa.data?.client_id) return { data: null, error: null };
    return await supabase.from("clients").select("name, address, phone").eq("id", soa.data.client_id).single();
  }, [soa.data?.client_id]);
  const orders = useData(
    () => supabase.from("orders").select("id, order_no, created_at, total_amount, amount_paid, order_items(quantity, unit_price, products(name))")
      .eq("soa_id", id).order("created_at"),
    [id],
  );

  if (soa.loading) return <Loading />;
  const s = soa.data;
  if (!s) return <Empty>Statement not found.</Empty>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="no-print flex w-full max-w-[180mm] flex-wrap gap-2">
        <Button variant="outline" size="touch" onClick={() => router.back()}><ArrowLeft /> Back</Button>
        {Number(s.balance) > 0 && <Button size="touch" onClick={() => setPaying(true)}><Wallet /> Record payment</Button>}
        <Button size="touch" variant="secondary" className="ml-auto" onClick={() => window.print()}><Printer /> Print</Button>
      </div>
      <style>{"@page { size: A4; margin: 15mm; }"}</style>

      <div className="w-full max-w-[180mm] overflow-x-auto bg-white p-6 text-sm text-black shadow print:p-0 print:shadow-none md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold">AQUA BEST</p>
            <p>Water Refilling Station</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">STATEMENT OF ACCOUNT</p>
            <p>SOA #{s.soa_no}</p>
            <p>Issued {dateOnly(s.generated_at)}</p>
            <div className="no-print mt-1"><StatusBadge status={s.status ?? "unpaid"} /></div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-neutral-500">Bill to</p>
            <p className="font-semibold">{client.data?.name ?? s.client_name}</p>
            {client.data?.address && <p>{client.data.address}</p>}
            {client.data?.phone && <p>{client.data.phone}</p>}
          </div>
          <div className="sm:text-right">
            <p><span className="text-neutral-500">Period:</span> {dateOnly(s.period_start)} – {dateOnly(s.period_end)}</p>
            <p><span className="text-neutral-500">Due date:</span> <span className="font-semibold">{dateOnly(s.due_date)}</span></p>
          </div>
        </div>

        <table className="mt-6 w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2">Date</th><th>Order</th><th>Items</th><th className="text-right">Amount</th><th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {orders.data?.map((o) => (
              <tr key={o.id} className="border-b border-neutral-300 align-top">
                <td className="py-2">{dateOnly(o.created_at)}</td>
                <td>#{o.order_no}</td>
                <td>{o.order_items.map((i) => `${i.quantity}× ${i.products?.name}`).join(", ")}</td>
                <td className="text-right">{peso(o.total_amount)}</td>
                <td className="text-right">{peso(Number(o.total_amount) - Number(o.amount_paid))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64">
          <p className="flex justify-between"><span>Total billed</span><span>{peso(s.total_amount_due)}</span></p>
          <p className="flex justify-between"><span>Payments received</span><span>{peso(s.amount_paid)}</span></p>
          <p className="mt-1 flex justify-between border-t-2 border-black pt-1 text-base font-bold"><span>Amount due</span><span>{peso(s.balance)}</span></p>
        </div>
        {s.notes && <p className="mt-6">{s.notes}</p>}
        <p className="mt-10 text-xs text-neutral-500">Generated {dateTime(s.generated_at)}. Please settle on or before the due date. Salamat po!</p>
      </div>

      <PayDialog soaId={id} balance={Number(s.balance)} open={paying} onOpenChange={setPaying}
        onPaid={() => { void soa.reload(); void orders.reload(); }} />
    </div>
  );
}

function PayDialog({ soaId, balance, open, onOpenChange, onPaid }: {
  soaId: string; balance: number; open: boolean; onOpenChange: (o: boolean) => void; onPaid: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc("record_soa_payment", {
      p_soa_id: soaId, p_amount: Number(amount || balance), p_method: method, p_reference: reference,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Payment recorded");
    setAmount(""); setReference("");
    onPaid();
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Record SOA payment" description={`Balance ${peso(balance)}`}
      footer={<Button size="touch" className="w-full" onClick={save} disabled={busy}>Save payment</Button>}>
      <div className="flex flex-col gap-3">
        <Field label="Amount" hint="Empty = full balance"><MoneyInput value={amount} onChange={setAmount} placeholder={peso(balance)} /></Field>
        <Field label="Method"><MethodSelect value={method} onChange={setMethod} /></Field>
        <ReferenceField method={method} value={reference} onChange={setReference} />
      </div>
    </ResponsiveDialog>
  );
}
