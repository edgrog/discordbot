"use client";

import { useState } from "react";
import { Form } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/forms/FormCard";
import { CreateFormDialog } from "@/components/forms/CreateFormDialog";
import { Plus, FileText } from "lucide-react";

interface FormsListClientProps {
  forms: Form[];
}

export function FormsListClient({ forms }: FormsListClientProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader title="FORMS" description="Build and manage Discord forms">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#BFFF00] text-[#141414] font-black uppercase tracking-wide text-sm border-2 border-[#141414] brutalist-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          Create Form
        </button>
      </PageHeader>

      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-ink/20">
          <div className="w-16 h-16 bg-[#BFFF00] border-2 border-ink flex items-center justify-center mb-6 brutalist-shadow">
            <FileText className="w-8 h-8 text-ink" strokeWidth={2.5} />
          </div>
          <p className="text-lg font-black text-ink uppercase tracking-wide mb-2">
            No forms yet
          </p>
          <p className="text-sm text-ink/50 font-medium mb-6">
            Create your first form to get started.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#141414] text-white font-black uppercase tracking-wide text-sm border-2 border-[#141414] brutalist-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Create Your First Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {forms.map((form) => (
            <FormCard key={form.id} form={form} />
          ))}
        </div>
      )}

      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
