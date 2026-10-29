import { Suspense } from "react";
import { Droplets } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ProfileProvider } from "@/components/profile-provider";

// Reading the session is request-time data, so it sits behind <Suspense>
// (required with Cache Components). The fallback is the static shell.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <ProfileProvider profile={profile}>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 text-primary">
      <Droplets className="size-6 animate-pulse" /> Loading…
    </div>
  );
}
