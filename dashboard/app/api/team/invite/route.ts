import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: dashUser } = await supabase
      .from("dashboard_users")
      .select("email, role")
      .eq("id", user.id)
      .single();

    if (!dashUser || dashUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, role } = await request.json();
    const service = createServiceClient();

    // Check if already exists
    const { data: existing } = await service
      .from("dashboard_users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Already a team member" },
        { status: 400 }
      );
    }

    // Invite via Supabase Auth admin API
    const { data: invited, error: inviteErr } =
      await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      });

    if (inviteErr) {
      return NextResponse.json(
        { error: inviteErr.message },
        { status: 500 }
      );
    }

    // Create dashboard_users row
    await service.from("dashboard_users").insert({
      id: invited.user.id,
      email,
      role: role || "member",
      created_by: user.id,
    });

    // Audit log
    await writeAuditLog({
      userId: user.id,
      userEmail: dashUser.email,
      action: "user_invite",
      targetType: "dashboard_user",
      targetId: invited.user.id,
      meta: { email, role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] Invite error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
