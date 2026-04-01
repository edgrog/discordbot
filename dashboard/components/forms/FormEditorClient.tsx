"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { FormConfig, FormField } from "@/lib/types";
import { StepList } from "./StepList";
import { FieldEditor } from "./FieldEditor";
import { DiscordPreview } from "./DiscordPreview";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface FormEditorClientProps {
  initialData: FormConfig[];
}

export function FormEditorClient({ initialData }: FormEditorClientProps) {
  const [formData, setFormData] = useState<FormConfig[]>(initialData);
  const [selectedKey, setSelectedKey] = useState<string>(
    initialData.length > 0
      ? `${initialData[0].category}_${initialData[0].step}`
      : ""
  );
  const [dirtySteps, setDirtySteps] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const selectedConfig = formData.find(
    (c) => `${c.category}_${c.step}` === selectedKey
  );

  const markDirty = useCallback(
    (id: number) => {
      setDirtySteps((prev) => new Set(prev).add(id));
    },
    []
  );

  function updateStep(id: number, updates: Partial<FormConfig>) {
    setFormData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    markDirty(id);
  }

  function updateStepTitle(id: number, title: string) {
    updateStep(id, { step_title: title });
  }

  function updateFields(id: number, fields: FormField[]) {
    updateStep(id, { fields });
  }

  function discardChanges() {
    setFormData(initialData);
    setDirtySteps(new Set());
    toast.info("Changes discarded");
  }

  async function saveChanges() {
    setIsSaving(true);
    const dirtyConfigs = formData.filter((c) => dirtySteps.has(c.id));

    try {
      for (const config of dirtyConfigs) {
        const res = await fetch(`/api/forms/${config.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step_title: config.step_title,
            fields: config.fields,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save");
        }
      }

      setDirtySteps(new Set());
      toast.success("Changes saved");

      // Auto-push to bot
      await pushToBot();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save changes"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function pushToBot() {
    setIsPushing(true);
    try {
      const res = await fetch("/api/forms/push", { method: "POST" });
      const data = await res.json();

      if (data.ok) {
        toast.success("Bot reloaded");
      } else {
        toast.warning(
          "Changes saved but bot unreachable — reload manually from Settings"
        );
      }
    } catch {
      toast.warning("Changes saved but bot unreachable");
    } finally {
      setIsPushing(false);
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <PageHeader title="Form Editor" description="Edit Formie application forms">
        <Button
          variant="outline"
          size="sm"
          onClick={pushToBot}
          disabled={isPushing}
          className="border-2 border-ink bg-chalk font-black uppercase tracking-wide hover:bg-pop-lime hover:text-ink brutalist-shadow-sm"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isPushing ? "animate-spin" : ""}`}
          />
          Push to Bot
        </Button>
      </PageHeader>

      {/* Unsaved changes banner */}
      {dirtySteps.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-pop-lime/20 border-2 border-ink px-4 py-3 brutalist-shadow-sm">
          <span className="text-sm font-black uppercase tracking-wide text-ink">
            You have unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={discardChanges}
              className="font-bold uppercase tracking-wide hover:bg-ink hover:text-chalk"
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={isSaving}
              className="bg-pop-lime text-ink border-2 border-ink font-black uppercase tracking-wide hover:bg-pop-lime/80 brutalist-shadow-sm"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex gap-4 h-[calc(100%-8rem)]">
        {/* Left — Step List */}
        <div className="w-60 flex-shrink-0 overflow-y-auto bg-card border-2 border-ink brutalist-shadow p-3">
          <StepList
            formData={formData}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        </div>

        {/* Center — Field Editor */}
        <div className="flex-1 overflow-y-auto bg-card border-2 border-ink brutalist-shadow p-6">
          {selectedConfig ? (
            <FieldEditor
              config={selectedConfig}
              onTitleChange={(title) =>
                updateStepTitle(selectedConfig.id, title)
              }
              onFieldsChange={(fields) =>
                updateFields(selectedConfig.id, fields)
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full text-ink/40 font-bold uppercase tracking-wide">
              Select a step from the sidebar
            </div>
          )}
        </div>

        {/* Right — Discord Preview */}
        <div className="w-80 flex-shrink-0 overflow-y-auto">
          {selectedConfig && <DiscordPreview config={selectedConfig} />}
        </div>
      </div>
    </div>
  );
}
