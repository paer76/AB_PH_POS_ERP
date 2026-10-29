"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

// Every action re-checks the caller: server actions are public endpoints.
async function assertOwner() {
  const me = await getProfile();
  if (!me || me.role !== "owner") throw new Error("Only the owner can manage staff");
  return me;
}

export type StaffRow = {
  id: string; full_name: string; role: "owner" | "secretary"; is_active: boolean; email: string | null; last_sign_in_at: string | null;
};

export async function listStaff(): Promise<Result<StaffRow[]>> {
  try {
    await assertOwner();
    const admin = createAdminClient();
    const [{ data: profiles, error }, { data: users, error: uErr }] = await Promise.all([
      admin.from("profiles").select("id, full_name, role, is_active").order("full_name"),
      admin.auth.admin.listUsers({ perPage: 200 }),
    ]);
    if (error || uErr) return { ok: false, error: (error ?? uErr)!.message };
    const byId = new Map(users.users.map((u) => [u.id, u]));
    return {
      ok: true,
      data: (profiles ?? []).map((p) => ({
        ...p,
        role: p.role as StaffRow["role"],
        email: byId.get(p.id)?.email ?? null,
        last_sign_in_at: byId.get(p.id)?.last_sign_in_at ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const CreateSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a name"),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["owner", "secretary"]),
});

export async function createStaff(input: z.input<typeof CreateSchema>): Promise<Result> {
  try {
    await assertOwner();
    const parsed = CreateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { full_name, email, password, role } = parsed.data;
    const { error } = await createAdminClient().auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name },
      app_metadata: { role }, // read by the handle_new_user trigger
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setStaffActive(userId: string, active: boolean): Promise<Result> {
  try {
    const me = await assertOwner();
    if (userId === me.id) return { ok: false, error: "You cannot deactivate yourself" };
    // Profile change as the owner (not service role) so the audit log records who did it.
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
    const admin = createAdminClient();
    // Also block sign-in at the auth level (and end their sessions on next refresh).
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    if (banErr) return { ok: false, error: banErr.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function resetStaffPassword(userId: string, password: string): Promise<Result> {
  try {
    await assertOwner();
    if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
    const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
