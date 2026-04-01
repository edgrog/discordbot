export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { Submission, Form } from "@/lib/types";
import { ApplicationsClient } from "./ApplicationsClient";

export default async function ApplicationsPage() {
  const supabase = createServiceClient();

  // TODO: TEMPORARY — auth bypassed for testing. Re-enable before production.

  // Initial data load — submissions joined with forms
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, forms!left(name, slug)")
    .order("created_at", { ascending: false })
    .limit(50);

  // Map joined form data to flat fields
  const mapped: Submission[] = (submissions || []).map((s: Record<string, unknown>) => {
    const form = s.forms as { name: string; slug: string } | null;
    return {
      ...s,
      form_name: form?.name ?? undefined,
      form_slug: form?.slug ?? undefined,
      forms: undefined,
    } as unknown as Submission;
  });

  // Fetch all forms for the filter dropdown
  const { data: forms } = await supabase
    .from("forms")
    .select("*")
    .order("name", { ascending: true });

  return (
    <ApplicationsClient
      initialData={mapped}
      forms={(forms as Form[]) || []}
      isAdmin={true}
    />
  );
}
