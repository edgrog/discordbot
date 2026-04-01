import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callBotApi } from "@/lib/bot-api";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    // Verify form exists
    const { data: form } = await service
      .from("forms")
      .select("id, name, status")
      .eq("id", id)
      .single();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Set form status to active
    const { error: updateError } = await service
      .from("forms")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert bot signal as backup
    await service.from("bot_signals").insert({
      signal: "reload_forms",
    });

    // Call bot API directly
    const result = await callBotApi("/api/reload-forms", { method: "POST" });

    return NextResponse.json({
      ok: true,
      deployed: true,
      botNotified: result.ok,
      warning: result.ok ? undefined : "bot_unreachable",
    });
  } catch (err) {
    console.error("[API] Form deploy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
