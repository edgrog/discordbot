export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { Form, FormStep } from "@/lib/types";
import { FormBuilderClient } from "@/components/forms/FormBuilderClient";

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .single();

  if (formError || !form) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="border-2 border-ink brutalist-shadow bg-chalk p-8 text-center">
          <h2 className="text-2xl font-black uppercase tracking-wide text-ink mb-2">
            404
          </h2>
          <p className="text-ink/60 font-bold">Form not found</p>
        </div>
      </div>
    );
  }

  const { data: steps } = await supabase
    .from("form_steps")
    .select("*")
    .eq("form_id", id)
    .order("position", { ascending: true });

  return (
    <FormBuilderClient
      initialForm={form as Form}
      initialSteps={(steps || []) as FormStep[]}
    />
  );
}
