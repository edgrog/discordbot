import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    const { data: form, error } = await service
      .from("forms")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const { data: steps } = await service
      .from("form_steps")
      .select("*")
      .eq("form_id", id)
      .order("position", { ascending: true });

    return NextResponse.json({ ok: true, data: { ...form, steps: steps || [] } });
  } catch (err) {
    console.error("[API] Form fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    const body = await request.json();
    const { name, slug, description, discord_command_name, settings } = body;

    // Validate slug if provided
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with hyphens only" },
        { status: 400 }
      );
    }

    // Fetch old values for audit
    const { data: oldForm } = await service
      .from("forms")
      .select("*")
      .eq("id", id)
      .single();

    if (!oldForm) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (discord_command_name !== undefined) updateData.discord_command_name = discord_command_name;
    if (settings !== undefined) updateData.settings = settings;

    const { data: updated, error } = await service
      .from("forms")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: "system",
      userEmail: "system",
      action: "form_update",
      targetType: "form",
      targetId: id,
      meta: { old: oldForm, new: updated },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    // Fetch form for audit before deleting
    const { data: form } = await service
      .from("forms")
      .select("*")
      .eq("id", id)
      .single();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const { error } = await service
      .from("forms")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog({
      userId: "system",
      userEmail: "system",
      action: "form_delete",
      targetType: "form",
      targetId: id,
      meta: { deleted: form },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] Form delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
