import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { callBotApi } from "@/lib/bot-api";

export async function POST() {
  try {
    // Auth check
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: dashUser } = await supabase
      .from("dashboard_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!dashUser || dashUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert bot signal as backup
    const service = createServiceClient();
    await service.from("bot_signals").insert({
      signal: "reload_forms",
    });

    // Call bot API directly
    const result = await callBotApi("/api/reload-forms", { method: "POST" });

    return NextResponse.json({
      ok: result.ok,
      error: result.ok ? undefined : result.error,
    });
  } catch (err) {
    console.error("[API] Forms push error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
