import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const formId = searchParams.get("formId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const sortField = searchParams.get("sortField") || "created_at";
    const sortDir = searchParams.get("sortDir") || "desc";

    let query = supabase
      .from("submissions")
      .select("*, forms!left(name, slug)")
      .order(sortField, { ascending: sortDir === "asc" })
      .limit(50);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (formId && formId !== "all") {
      query = query.eq("form_id", formId);
    }
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo + "T23:59:59");
    }
    if (search) {
      query = query.or(
        `discord_username.ilike.%${search}%,discord_id.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map joined form data
    const mapped = (data || []).map((s: Record<string, unknown>) => {
      const form = s.forms as { name: string; slug: string } | null;
      return {
        ...s,
        form_name: form?.name ?? undefined,
        form_slug: form?.slug ?? undefined,
        forms: undefined,
      };
    });

    return NextResponse.json({ data: mapped });
  } catch (err) {
    console.error("[API] Submissions list error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
