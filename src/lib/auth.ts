import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "secretary";
export type Profile = { id: string; full_name: string; role: Role; email: string | null };

/** Current signed-in, active staff profile — or null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    role: data.role as Role,
    email: (claims.claims.email as string | undefined) ?? null,
  };
}

/** Like getProfile, but redirects to /login when signed out (or deactivated). */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireOwner(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "owner") redirect("/pos");
  return profile;
}

export function homeFor(role: Role) {
  return role === "owner" ? "/dashboard" : "/pos";
}
