"use client";

import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/format";
import { Field } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MethodSelect({ value, onChange }: { value: PaymentMethod; onChange: (v: PaymentMethod) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
      <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function MoneyInput({ id, value, onChange, placeholder = "0.00", autoFocus }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <Input id={id} autoFocus={autoFocus} inputMode="decimal" placeholder={placeholder} className="h-12 text-lg"
      value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} />
  );
}

export function ReferenceField({ method, value, onChange }: { method: PaymentMethod; value: string; onChange: (v: string) => void }) {
  if (method === "cash") return null;
  return (
    <Field label="Reference no. (optional)" htmlFor="pay-ref">
      <Input id="pay-ref" className="h-11" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. GCash ref" />
    </Field>
  );
}
