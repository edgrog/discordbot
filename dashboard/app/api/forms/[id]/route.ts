import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      .select("id, email, role")
      .eq("id", user.id)
      .single();

    if (!dashUser || dashUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { step_title, fields } = body;

    // Validation
    if (step_title && step_title.length > 45) {
      return NextResponse.json(
        { error: "Step title must be 45 characters or fewer" },
        { status: 400 }
      );
    }

    if (fields) {
      if (fields.length > 5) {
        return NextResponse.json(
          { error: "Maximum 5 fields per step" },
          { status: 400 }
        );
      }
      for (const f of fields) {
        if (f.label && f.label.length > 45) {
          return NextResponse.json(
            { error: `Label "${f.label}" exceeds 45 characters` },
            { status: 400 }
          );
        }
        if (f.placeholder && f.placeholder.length > 100) {
          return NextResponse.json(
            { error: `Placeholder for "${f.label}" exceeds 100 characters` },
            { status: 400 }
          );
        }
      }
    }

    const service = createServiceClient();

    // Fetch old values for audit
    const { data: oldConfig } = await service
      .from("form_config")
      .select("*")
      .eq("id", id)
      .single();

    if (!oldConfig) {
      return NextResponse.json(
        { error: "Form config not found" },
        { status: 404 }
      );
    }

    // Update
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (step_title !== undefined) updateData.step_title = step_title;
    if (fields !== undefined) updateData.fields = fields;

    const { data: updated, error } = await service
      .from("form_config")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: user.id,
      userEmail: dashUser.email,
      action: "form_edit",
      targetType: "form_config",
      targetId: id,
      meta: {
        old: {
          step_title: oldConfig.step_title,
          fields: oldConfig.fields,
        },
        new: {
          step_title: updated.step_title,
          fields: updated.fields,
        },
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[API] Form update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
