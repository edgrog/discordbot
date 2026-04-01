import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callBotApi } from "@/lib/bot-api";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const service = createServiceClient();

    // TODO: re-enable auth once session flow is wired up
    const reviewerName = "dashboard-user";

    // Race condition guard: check submission exists and is still pending
    const { data: submission } = await service
      .from("submissions")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (submission.status !== "pending") {
      return NextResponse.json({
        ok: false,
        error: "already_reviewed",
        currentStatus: submission.status,
      });
    }

    // Call bot API
    const botResult = await callBotApi(`/api/submissions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({
        reviewerName,
        note: body.note,
      }),
    });

    // If bot unreachable, update DB directly
    if (!botResult.ok && botResult.error !== "already_reviewed") {
      await service
        .from("submissions")
        .update({
          status: "approved",
          reviewed_by: reviewerName,
          review_note: body.note || null,
        })
        .eq("id", id);
    }

    // Audit log
    await writeAuditLog({
      userId: "system",
      userEmail: reviewerName,
      action: "approve",
      targetType: "submission",
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
    console.error("[API] Submission approve error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
