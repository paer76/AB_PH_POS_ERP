"use client";

import { redirect } from "next/navigation";
import { useProfile } from "@/components/profile-provider";

// UX guard only — owner data is protected by RLS / require_owner() in Postgres.
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { role } = useProfile();
  if (role !== "owner") redirect("/pos");
  return children;
}
