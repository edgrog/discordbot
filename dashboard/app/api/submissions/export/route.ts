import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const service = createServiceClient();
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("form_id");
    const status = searchParams.get("status");

    if (!formId) {
      return NextResponse.json(
        { error: "form_id is required" },
        { status: 400 }
      );
    }

    // Fetch form steps to get field labels for CSV headers
    const { data: steps, error: stepsError } = await service
      .from("form_steps")
      .select("position, title, fields")
      .eq("form_id", formId)
      .order("position", { ascending: true });

    if (stepsError) {
      console.error("[API] Export steps error:", stepsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch form steps" },
        { status: 500 }
      );
    }

    // Build ordered list of field keys and labels from form steps
    const fieldColumns: { key: string; label: string }[] = [];
    for (const step of steps || []) {
      const fields = (step.fields as Array<{ name: string; label?: string }>) || [];
      for (const field of fields) {
        if (field.name) {
          fieldColumns.push({
            key: field.name,
            label: field.label || field.name,
          });
        }
      }
    }

    // Fetch submissions
    let query = service
      .from("submissions")
      .select("discord_username, status, created_at, answers")
      .eq("form_id", formId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: submissions, error: subError } = await query;

    if (subError) {
      console.error("[API] Export submissions error:", subError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch submissions" },
        { status: 500 }
      );
    }

    // Build CSV
    const fixedHeaders = ["discord_username", "status", "created_at"];
    const allHeaders = [
      ...fixedHeaders,
      ...fieldColumns.map((f) => f.label),
    ];

    const rows: string[] = [allHeaders.map(escapeCsv).join(",")];

    for (const sub of submissions || []) {
      const answers = (sub.answers as Record<string, unknown>) || {};
      const row = [
        escapeCsv(sub.discord_username || ""),
        escapeCsv(sub.status || ""),
        escapeCsv(sub.created_at || ""),
        ...fieldColumns.map((f) => escapeCsv(String(answers[f.key] ?? ""))),
      ];
      rows.push(row.join(","));
    }

    const csv = rows.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="submissions-${formId}.csv"`,
      },
    });
  } catch (err) {
    console.error("[API] Export error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
