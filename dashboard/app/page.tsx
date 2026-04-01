export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { Submission } from "@/lib/types";
import { Sidebar } from "@/components/shared/Sidebar";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { FileText, Clock, CheckCircle2, XCircle } from "lucide-react";

export default async function HomePage() {
  const supabase = createServiceClient();

  // TODO: TEMPORARY — auth bypassed for testing. Re-enable before production.
  const dashUser = { email: "ed@grog.shop", name: "Ed", role: "admin" as const };

  const { count: totalCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true });

  const { count: pendingCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const { count: approvedMonth } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")
    .gte("created_at", firstOfMonth.toISOString());

  const { count: rejectedMonth } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected")
    .gte("created_at", firstOfMonth.toISOString());

  // Fetch recent submissions joined with forms
  const { data: recentRaw } = await supabase
    .from("submissions")
    .select("*, forms!left(name, slug)")
    .order("created_at", { ascending: false })
    .limit(10);

  const recentApps: Submission[] = (recentRaw || []).map((s: Record<string, unknown>) => {
    const form = s.forms as { name: string; slug: string } | null;
    return {
      ...s,
      form_name: form?.name ?? undefined,
      form_slug: form?.slug ?? undefined,
      forms: undefined,
    } as unknown as Submission;
  });

  // Fetch submissions grouped by form for chart
  const { data: allSubs } = await supabase
    .from("submissions")
    .select("form_id, forms!left(name)");

  const formCounts: Record<string, number> = {};
  for (const sub of allSubs || []) {
    const form = (sub as Record<string, unknown>).forms as { name: string } | null;
    const formName = form?.name || "Unknown";
    formCounts[formName] = (formCounts[formName] || 0) + 1;
  }

  return (
    <div className="min-h-screen bg-chalk">
      <Sidebar
        userEmail={dashUser.email}
        userName={dashUser.name}
        userRole={dashUser.role}
      />
      <main className="ml-64 p-8">
        <PageHeader title="Dashboard" description="Your form submissions at a glance" />

        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatsCard
            title="Total"
            value={totalCount || 0}
            icon={FileText}
          />
          <StatsCard
            title="Pending"
            value={pendingCount || 0}
            icon={Clock}
            pulse={!!pendingCount && pendingCount > 0}
            accentColor="#FF6B00"
          />
          <StatsCard
            title="Approved"
            value={approvedMonth || 0}
            icon={CheckCircle2}
            accentColor="#BFFF00"
          />
          <StatsCard
            title="Rejected"
            value={rejectedMonth || 0}
            icon={XCircle}
            accentColor="#FF3366"
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <RecentApplications applications={recentApps} />
          </div>
          <div>
            <CategoryChart data={formCounts} />
          </div>
        </div>
      </main>
    </div>
  );
}
