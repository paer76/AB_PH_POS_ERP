"use client";

import { peso, dateTime } from "@/lib/format";
import type { ShiftSummary } from "@/hooks/use-shift";
import { Row } from "@/components/common";
import { Separator } from "@/components/ui/separator";

export function ShiftSummaryView({ s }: { s: ShiftSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <Row label="Opened">{dateTime(s.opened_at)}</Row>
      {s.closed_at && <Row label="Closed">{dateTime(s.closed_at)}</Row>}
      <Row label="Orders">{s.orders}</Row>
      <Row label="Sales (incl. utang)">{peso(s.sales)}</Row>
      <Separator className="my-1" />
      <Row label="Opening cash">{peso(s.opening_cash)}</Row>
      <Row label="+ Cash payments">{peso(s.cash_payments)}</Row>
      <Row label="+ Cash in">{peso(s.cash_in)}</Row>
      <Row label="− Expenses">{peso(s.expenses)}</Row>
      <Row label="− Cash out">{peso(s.cash_out)}</Row>
      <Row label="Expected in drawer" className="text-base">{peso(s.expected_cash)}</Row>
      <Row label="Non-cash collected">{peso(s.non_cash_payments)}</Row>
      {s.closing_cash != null && (
        <>
          <Separator className="my-1" />
          <Row label="Counted">{peso(s.closing_cash)}</Row>
          <Row label="Variance">
            <span className={Number(s.variance) < 0 ? "text-destructive" : Number(s.variance) > 0 ? "text-amber-600" : "text-emerald-600"}>
              {peso(s.variance)}
            </span>
          </Row>
        </>
      )}
    </div>
  );
}
