import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export type DashUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
};

export async function getCurrentUser(): Promise<DashUser | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: dashUser } = await supabase
    .from("dashboard_users")
    .select("id, email, name, role")
    .eq("id", user.id)
    .single();

  return (dashUser as DashUser) || null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
