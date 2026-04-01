import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

// PATCH — update role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { role } = await request.json();
    const service = createServiceClient();

    // Get old values
    const { data: target } = await service
      .from("dashboard_users")
      .select("email, role")
      .eq("id", id)
      .single();

    await service
      .from("dashboard_users")
      .update({ role })
      .eq("id", id);

    await writeAuditLog({
      userId: user.id,
      userEmail: dashUser.email,
      action: "user_role_change",
      targetType: "dashboard_user",
      targetId: id,
      meta: { email: target?.email, oldRole: target?.role, newRole: role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] Role update error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.id === id) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    const { data: dashUser } = await supabase
      .from("dashboard_users")
      .select("email, role")
      .eq("id", user.id)
      .single();

    if (!dashUser || dashUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const service = createServiceClient();

    // Get target info for audit
    const { data: target } = await service
      .from("dashboard_users")
      .select("email")
      .eq("id", id)
      .single();

    // Delete from dashboard_users
    await service.from("dashboard_users").delete().eq("id", id);

    // Disable auth user
    await service.auth.admin.deleteUser(id);

    await writeAuditLog({
      userId: user.id,
      userEmail: dashUser.email,
      action: "user_remove",
      targetType: "dashboard_user",
      targetId: id,
      meta: { email: target?.email },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] Remove user error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
