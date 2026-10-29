"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between md:mb-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending_delivery: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  out_for_delivery: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  voided: "bg-muted text-muted-foreground line-through",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  partially_paid: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  unpaid: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  overdue: "bg-rose-600 text-white",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-muted text-muted-foreground",
  open: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  closed: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("border-0 capitalize", STATUS_STYLE[status])}>
      {STATUS_LABEL[status] ?? status.replaceAll("_", " ")}
    </Badge>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10 text-muted-foreground", className)}>
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p>;
}

/** A label/value row used in stacked mobile cards and summaries. */
export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
