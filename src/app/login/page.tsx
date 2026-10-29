"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Droplets, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorNote, Field } from "@/components/common";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Droplets className="size-8" />
          </div>
          <CardTitle className="text-2xl">Aqua Best</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" inputMode="email" required
                className="h-11 text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" required
                className="h-11 text-base" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" size="touch" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Accounts are created by the owner. Forgot your password? Ask the owner to reset it.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
