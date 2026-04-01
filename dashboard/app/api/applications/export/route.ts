import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceClient();
    const { searchParams } = request.nextUrl;

    let query = service
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false });

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,discord_username.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      return new NextResponse("No data to export", { status: 404 });
    }

    // Collect all unique answer keys
    const answerKeys = new Set<string>();
    for (const row of data) {
      if (row.answers && typeof row.answers === "object") {
        for (const key of Object.keys(row.answers)) {
          if (!["category", "existingApps"].includes(key)) {
            answerKeys.add(key);
          }
        }
      }
    }

    const baseHeaders = [
      "id",
      "created_at",
      "discord_id",
      "discord_username",
      "full_name",
      "email",
      "phone",
      "dob",
      "address",
      "city",
      "state",
      "zip",
      "country",
      "category",
      "status",
      "reviewed_by",
      "review_note",
      "dm_sent",
    ];

    const sortedAnswerKeys = Array.from(answerKeys).sort();
    const allHeaders = [...baseHeaders, ...sortedAnswerKeys];

    const escapeCSV = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [allHeaders.join(",")];
    for (const row of data) {
      const values = allHeaders.map((h) => {
        if (baseHeaders.includes(h)) {
          return escapeCSV((row as Record<string, unknown>)[h]);
        }
        return escapeCSV(row.answers?.[h]);
      });
      lines.push(values.join(","));
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="applications_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error("[API] Export error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
