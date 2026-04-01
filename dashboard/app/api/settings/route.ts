import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
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

    const { updates } = await request.json();
    const service = createServiceClient();

    // Get old values for audit
    const keys = updates.map((u: { key: string }) => u.key);
    const { data: oldSettings } = await service
      .from("settings")
      .select("key, value")
      .in("key", keys);

    const oldMap: Record<string, string> = {};
    for (const row of oldSettings || []) {
      oldMap[row.key] = row.value;
    }

    // Upsert each setting
    for (const update of updates) {
      await service.from("settings").upsert({
        key: update.key,
        value: update.value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      });
    }

    // Build audit meta
    const meta: Record<string, { old: string; new: string }> = {};
    for (const update of updates) {
      if (oldMap[update.key] !== update.value) {
        meta[update.key] = {
          old: oldMap[update.key] || "",
          new: update.value,
        };
      }
    }

    if (Object.keys(meta).length > 0) {
      await writeAuditLog({
        userId: user.id,
        userEmail: dashUser.email,
        action: "settings_update",
        targetType: "settings",
        targetId: keys.join(","),
        meta,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] Settings update error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
