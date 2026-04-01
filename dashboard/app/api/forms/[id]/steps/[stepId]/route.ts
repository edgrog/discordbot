import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: formId, stepId } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    const body = await request.json();
    const { title, fields } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (fields !== undefined) updateData.fields = fields;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data: step, error } = await service
      .from("form_steps")
      .update(updateData)
      .eq("id", stepId)
      .eq("form_id", formId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: step });
  } catch (err) {
    console.error("[API] Step update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: formId, stepId } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    // Get the step's position before deleting
    const { data: step } = await service
      .from("form_steps")
      .select("position")
      .eq("id", stepId)
      .eq("form_id", formId)
      .single();

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    // Delete the step
    const { error: deleteError } = await service
      .from("form_steps")
      .delete()
      .eq("id", stepId)
      .eq("form_id", formId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Reorder remaining steps to fill the gap
    const { data: remaining } = await service
      .from("form_steps")
      .select("id, position")
      .eq("form_id", formId)
      .gt("position", step.position)
      .order("position", { ascending: true });

    if (remaining && remaining.length > 0) {
      for (const s of remaining) {
        await service
          .from("form_steps")
          .update({ position: s.position - 1 })
          .eq("id", s.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] Step delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
