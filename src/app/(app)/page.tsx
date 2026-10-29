"use client";

import { redirect } from "next/navigation";
import { useProfile } from "@/components/profile-provider";

export default function Home() {
  const { role } = useProfile();
  redirect(role === "owner" ? "/dashboard" : "/pos");
}
