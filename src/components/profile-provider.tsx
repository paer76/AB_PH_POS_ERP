"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/lib/auth";

const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  return <ProfileContext value={profile}>{children}</ProfileContext>;
}

export function useProfile() {
  const p = useContext(ProfileContext);
  if (!p) throw new Error("useProfile must be used inside the app layout");
  return p;
}
