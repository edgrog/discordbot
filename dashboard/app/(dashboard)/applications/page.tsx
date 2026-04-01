import { createServerClient } from "@/lib/supabase/server";
import { PartnerApplication } from "@/lib/types";
import { ApplicationsClient } from "./ApplicationsClient";

export default async function ApplicationsPage() {
  const supabase = await createServerClient();

  // Get current user role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: dashUser } = await supabase
    .from("dashboard_users")
    .select("role")
    .eq("id", user!.id)
    .single();

  // Initial data load
  const { data: applications } = await supabase
    .from("partner_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ApplicationsClient
      initialData={(applications as PartnerApplication[]) || []}
      isAdmin={dashUser?.role === "admin"}
    />
  );
}
