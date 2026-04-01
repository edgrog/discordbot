export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shared/Sidebar";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { FileText, Clock, CheckCircle2, XCircle } from "lucide-react";

export default async function HomePage() {
  const supabase = await createServerClient();

  // TODO: TEMPORARY — auth bypassed for testing. Re-enable before production.
  const dashUser = { email: "ed@grog.shop", name: "Ed", role: "admin" as const };

  const { count: totalCount } = await supabase
    .from("partner_applications")
    .select("*", { count: "exact", head: true });

  const { count: pendingCount } = await supabase
    .from("partner_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const { count: approvedMonth } = await supabase
    .from("partner_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")
    .gte("created_at", firstOfMonth.toISOString());

  const { count: rejectedMonth } = await supabase
    .from("partner_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected")
    .gte("created_at", firstOfMonth.toISOString());

  const { data: recentApps } = await supabase
    .from("partner_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: allApps } = await supabase
    .from("partner_applications")
    .select("category");

  const categoryCounts: Record<string, number> = {};
  for (const app of allApps || []) {
    categoryCounts[app.category] = (categoryCounts[app.category] || 0) + 1;
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
            <RecentApplications applications={recentApps || []} />
          </div>
          <div>
            <CategoryChart data={categoryCounts} />
          </div>
        </div>
      </main>
    </div>
  );
}
