export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { Form } from "@/lib/types";
import { FormsListClient } from "@/components/forms/FormsListClient";

export default async function FormsPage() {
  const supabase = createServiceClient();

  // Fetch all forms
  const { data: forms, error: formsError } = await supabase
    .from("forms")
    .select("*")
    .order("created_at", { ascending: false });

  if (formsError) {
    console.error("[FormsPage] Error fetching forms:", formsError);
  }

  // Fetch submission counts per form
  const formsList: Form[] = (forms as Form[]) || [];

  if (formsList.length > 0) {
    const formIds = formsList.map((f) => f.id);
    const { data: counts } = await supabase
      .from("submissions")
      .select("form_id")
      .in("form_id", formIds);

    if (counts) {
      const countMap: Record<string, number> = {};
      for (const row of counts) {
        countMap[row.form_id] = (countMap[row.form_id] || 0) + 1;
      }
      for (const form of formsList) {
        form.submission_count = countMap[form.id] || 0;
      }
    }
  }

  return <FormsListClient forms={formsList} />;
}
