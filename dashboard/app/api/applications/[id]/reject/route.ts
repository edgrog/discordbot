import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { callBotApi } from "@/lib/bot-api";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
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

    if (!dashUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const service = createServiceClient();

    // Check current status
    const { data: app } = await service
      .from("partner_applications")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!app) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (app.status !== "pending") {
      return NextResponse.json({
        ok: false,
        error: "already_reviewed",
        currentStatus: app.status,
      });
    }

    // Call bot API
    const botResult = await callBotApi(`/api/applications/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({
        reviewerName: dashUser.email,
        note: body.note,
      }),
    });

    // If bot unreachable, update DB directly
    if (!botResult.ok && botResult.error !== "already_reviewed") {
      await service
        .from("partner_applications")
        .update({
          status: "rejected",
          reviewed_by: dashUser.email,
          review_note: body.note || null,
        })
        .eq("id", id);
    }

    // Audit log
    await writeAuditLog({
      userId: user.id,
      userEmail: dashUser.email,
      action: "reject",
      targetType: "application",
      targetId: id,
      meta: { note: body.note, botReachable: botResult.ok },
    });

    if (botResult.error === "already_reviewed") {
      return NextResponse.json(botResult);
    }

    return NextResponse.json({
      ok: true,
      warning: botResult.ok ? undefined : "bot_unreachable",
    });
  } catch (err) {
    console.error("[API] Reject error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
