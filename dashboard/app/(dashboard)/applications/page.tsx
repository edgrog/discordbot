export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PartnerApplication } from "@/lib/types";
import { ApplicationsClient } from "./ApplicationsClient";

export default async function ApplicationsPage() {
  const supabase = await createServerClient();

  // TODO: TEMPORARY — auth bypassed for testing. Re-enable before production.

  // Initial data load
  const { data: applications } = await supabase
    .from("partner_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ApplicationsClient
      initialData={(applications as PartnerApplication[]) || []}
      isAdmin={true}
    />
  );
}
