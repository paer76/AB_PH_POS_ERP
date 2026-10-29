"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3, Boxes, Bike, ClipboardList, Droplets, FileText, History, LayoutDashboard, LogOut,
  Menu, Receipt, ShieldAlert, ShoppingCart, Timer, Truck, Users, UserCog, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type NavItem = { href: string; label: string; icon: typeof Droplets };

const COUNTER: NavItem[] = [
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/deliveries", label: "Deliveries", icon: Truck },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/shift", label: "Shift", icon: Timer },
];

const OWNER: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/voids", label: "Voids", icon: ShieldAlert },
  { href: "/soa", label: "SOA", icon: FileText },
  { href: "/shifts", label: "Shifts", icon: History },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/riders", label: "Riders", icon: Bike },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/audit", label: "Audit log", icon: Receipt },
];

// Bottom tab bar (phones): the 4 most-used screens + "More"
const MOBILE_TABS = {
  secretary: ["/pos", "/deliveries", "/clients", "/shift"],
  owner: ["/dashboard", "/reports", "/voids", "/clients"],
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const sections =
    profile.role === "owner"
      ? [{ title: "Owner", items: OWNER }, { title: "Counter", items: COUNTER }]
      : [{ title: "Counter", items: COUNTER }];
  const all = sections.flatMap((s) => s.items);
  const tabs = MOBILE_TABS[profile.role].map((h) => all.find((i) => i.href === h)!);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navList = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-4">
      {sections.map((s) => (
        <div key={s.title} className="flex flex-col gap-1">
          {sections.length > 1 && (
            <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{s.title}</p>
          )}
          {s.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                isActive(pathname, item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const userBox = (
    <div className="flex items-center justify-between gap-2 border-t pt-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
      </div>
      <Button variant="ghost" size="icon-touch" onClick={signOut} aria-label="Sign out">
        <LogOut className="size-5" />
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar: tablets & desktop */}
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r bg-sidebar p-3 md:flex">
        <Link href="/" className="flex items-center gap-2 px-2 py-1 text-lg font-semibold text-primary">
          <Droplets className="size-6" /> Aqua Best
        </Link>
        <div className="flex-1 overflow-y-auto">{navList()}</div>
        {userBox}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: phones */}
        <header className="no-print pt-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
            <Droplets className="size-5" /> Aqua Best
          </Link>
          <span className="truncate text-sm text-muted-foreground">{profile.full_name}</span>
        </header>

        {/* Leave room for the bottom tab bar on phones */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Bottom tab bar: phones */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background md:hidden">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isActive(pathname, t.href) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <t.icon className="size-5" />
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="flex w-72 flex-col gap-4 p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{navList(() => setMoreOpen(false))}</div>
          {userBox}
        </SheetContent>
      </Sheet>
    </div>
  );
}
