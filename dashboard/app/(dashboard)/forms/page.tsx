export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { FormConfig } from "@/lib/types";
import { FormEditorClient } from "@/components/forms/FormEditorClient";

export default async function FormsPage() {
  const supabase = await createServerClient();
  const { data: formConfigs } = await supabase
    .from("form_config")
    .select("*")
    .order("category")
    .order("step");

  return <FormEditorClient initialData={(formConfigs as FormConfig[]) || []} />;
}
