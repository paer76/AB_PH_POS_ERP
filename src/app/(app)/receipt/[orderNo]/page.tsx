"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dateTime, methodLabel, peso } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { ORDER_SELECT } from "@/components/order-detail";
import { Empty, Loading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ReceiptPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = use(params);
  const router = useRouter();
  const [paper, setPaper] = useState<"thermal" | "a4">("thermal");
  const q = useData(
    () => createClient().from("orders").select(ORDER_SELECT).eq("order_no", Number(orderNo)).single(),
    [orderNo],
  );

  if (q.loading) return <Loading />;
  const o = q.data;
  if (!o) return <Empty>Receipt not found.</Empty>;
  const balance = Number(o.total_amount) - Number(o.amount_paid);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="no-print flex w-full max-w-md flex-wrap gap-2">
        <Button variant="outline" size="touch" onClick={() => router.back()}><ArrowLeft /> Back</Button>
        <Button variant={paper === "thermal" ? "secondary" : "ghost"} size="touch" onClick={() => setPaper("thermal")}>58/80mm</Button>
        <Button variant={paper === "a4" ? "secondary" : "ghost"} size="touch" onClick={() => setPaper("a4")}>A4</Button>
        <Button size="touch" className="ml-auto" onClick={() => window.print()}><Printer /> Print</Button>
      </div>

      {/* @page size follows the selected paper */}
      <style>{paper === "thermal" ? "@page { size: 80mm auto; margin: 3mm; }" : "@page { size: A4; margin: 15mm; }"}</style>

      <div className={cn("bg-white font-mono text-black shadow print:shadow-none",
        paper === "thermal" ? "w-[76mm] p-3 text-[12px]" : "w-full max-w-[180mm] p-8 text-sm")}>
        <div className="text-center">
          <p className="text-base font-bold">AQUA BEST</p>
          <p>Water Refilling Station</p>
          <p className="mt-2">{o.order_type === "delivery" ? "DELIVERY RECEIPT" : "SALES RECEIPT"} #{o.order_no}</p>
          <p>{dateTime(o.created_at)}</p>
        </div>
        <hr className="my-2 border-dashed border-black" />
        {o.clients && (
          <>
            <p>Customer: {o.clients.name}</p>
            {o.delivery_address && <p>Address: {o.delivery_address}</p>}
            <hr className="my-2 border-dashed border-black" />
          </>
        )}
        {o.order_items.map((i) => (
          <div key={i.id}>
            <p>{i.products?.name}</p>
            <p className="flex justify-between"><span>{i.quantity} × {peso(i.unit_price)}</span><span>{peso(i.subtotal)}</span></p>
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        <p className="flex justify-between font-bold"><span>TOTAL</span><span>{peso(o.total_amount)}</span></p>
        {o.payments.map((p) => (
          <p key={p.id} className="flex justify-between"><span>Paid ({methodLabel(p.method)})</span><span>{peso(p.amount)}</span></p>
        ))}
        {balance > 0 && o.status !== "voided" && (
          <p className="flex justify-between font-bold"><span>BALANCE</span><span>{peso(balance)}</span></p>
        )}
        {o.status === "voided" && <p className="mt-2 text-center font-bold">*** VOIDED ***</p>}
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center">Thank you! Salamat po!</p>
        <p className="mt-1 text-center text-[10px]">This is not an official receipt.</p>
      </div>
    </div>
  );
}
