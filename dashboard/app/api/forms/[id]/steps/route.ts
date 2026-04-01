import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    // Verify form exists
    const { data: form } = await service
      .from("forms")
      .select("id")
      .eq("id", formId)
      .single();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, fields } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Get max position for this form
    const { data: existing } = await service
      .from("form_steps")
      .select("position")
      .eq("form_id", formId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { data: step, error } = await service
      .from("form_steps")
      .insert({
        form_id: formId,
        title,
        fields: fields || [],
        position: nextPosition,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: step }, { status: 201 });
  } catch (err) {
    console.error("[API] Step create error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params;

    // TODO: TEMPORARY — auth bypassed for testing
    const service = createServiceClient();

    // Verify form exists
    const { data: form } = await service
      .from("forms")
      .select("id")
      .eq("id", formId)
      .single();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const body = await request.json();
    const { steps } = body;

    if (!Array.isArray(steps)) {
      return NextResponse.json(
        { error: "Steps array is required" },
        { status: 400 }
      );
    }

    // Delete all existing steps for this form
    const { error: deleteError } = await service
      .from("form_steps")
      .delete()
      .eq("form_id", formId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Re-insert all steps with correct positions
    if (steps.length > 0) {
      const rows = steps.map((step: { title: string; fields: unknown[] }, index: number) => ({
        form_id: formId,
        title: step.title,
        fields: step.fields || [],
        position: index,
      }));

      const { data: inserted, error: insertError } = await service
        .from("form_steps")
        .insert(rows)
        .select();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, data: inserted });
    }

    return NextResponse.json({ ok: true, data: [] });
  } catch (err) {
    console.error("[API] Steps bulk update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
