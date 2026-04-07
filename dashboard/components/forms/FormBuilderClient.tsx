"use client";

import { useState, useCallback, useMemo } from "react";
import { Form, FormStep, FormField, FORM_STATUS_COLORS } from "@/lib/types";
import { StepList } from "./StepList";
import { FieldEditor } from "./FieldEditor";
import { DiscordPreview } from "./DiscordPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Rocket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface FormBuilderClientProps {
  initialForm: Form;
  initialSteps: FormStep[];
}

export function FormBuilderClient({
  initialForm,
  initialSteps,
}: FormBuilderClientProps) {
  const [form, setForm] = useState<Form>(initialForm);
  const [steps, setSteps] = useState<FormStep[]>(initialSteps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    initialSteps.length > 0 ? initialSteps[0].id : null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) || null,
    [steps, selectedStepId]
  );

  const statusColors = FORM_STATUS_COLORS[form.status] || FORM_STATUS_COLORS.draft;

  // --- Mutations ---

  function markDirty() {
    setHasUnsavedChanges(true);
  }

  function handleFormNameChange(name: string) {
    setForm((prev) => ({ ...prev, name }));
    markDirty();
  }

  function handleAddStep(title?: string, selectAfterCreate = true, asBranchTarget = false): number {
    const position = steps.length;
    const newStep: FormStep = {
      id: `new_${Date.now()}`,
      form_id: form.id,
      position,
      title: title || `Step ${position + 1}`,
      step_type: "fields",
      fields: [],
      options: null,
      next_step: asBranchTarget ? -1 : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, newStep]);
    if (selectAfterCreate) setSelectedStepId(newStep.id);
    markDirty();
    return position;
  }

  function handleDeleteStep(stepId: string) {
    setSteps((prev) => {
      const deletedStep = prev.find((s) => s.id === stepId);
      const deletedPos = deletedStep?.position ?? -1;
      const filtered = prev.filter((s) => s.id !== stepId);
      // Reindex positions and null out any routing references to the deleted step
      return filtered.map((s, i) => {
        let next_step = s.next_step;
        if (next_step === deletedPos) next_step = null;

        let options = s.options;
        if (options) {
          options = options.map((o) =>
            o.next_step === deletedPos ? { ...o, next_step: null } : o
          );
        }

        return { ...s, position: i, next_step, options };
      });
    });
    if (selectedStepId === stepId) {
      setSelectedStepId(() => {
        const remaining = steps.filter((s) => s.id !== stepId);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    }
    markDirty();
  }

  function handleReorderSteps(reorderedSteps: FormStep[]) {
    // Build position remap: oldPosition → newPosition
    const posMap = new Map<number, number>();
    reorderedSteps.forEach((s, newIdx) => {
      if (s.position !== newIdx) posMap.set(s.position, newIdx);
    });

    setSteps(
      reorderedSteps.map((s, i) => {
        let next_step = s.next_step;
        if (next_step !== null && posMap.has(next_step)) {
          next_step = posMap.get(next_step)!;
        }

        let options = s.options;
        if (options) {
          options = options.map((o) => {
            if (o.next_step !== null && posMap.has(o.next_step)) {
              return { ...o, next_step: posMap.get(o.next_step)! };
            }
            return o;
          });
        }

        return { ...s, position: i, next_step, options };
      })
    );
    markDirty();
  }

  const handleStepTitleChange = useCallback(
    (title: string) => {
      if (!selectedStepId) return;
      setSteps((prev) =>
        prev.map((s) => (s.id === selectedStepId ? { ...s, title } : s))
      );
      markDirty();
    },
    [selectedStepId]
  );

  const handleStepDescriptionChange = useCallback(
    (description: string) => {
      if (!selectedStepId) return;
      setSteps((prev) =>
        prev.map((s) => (s.id === selectedStepId ? { ...s, description } : s))
      );
      markDirty();
    },
    [selectedStepId]
  );

  const handleFieldsChange = useCallback(
    (fields: FormField[]) => {
      if (!selectedStepId) return;
      setSteps((prev) =>
        prev.map((s) => (s.id === selectedStepId ? { ...s, fields } : s))
      );
      markDirty();
    },
    [selectedStepId]
  );

  const handleNextStepChange = useCallback(
    (next_step: number | null) => {
      if (!selectedStepId) return;
      setSteps((prev) =>
        prev.map((s) => (s.id === selectedStepId ? { ...s, next_step } : s))
      );
      markDirty();
    },
    [selectedStepId]
  );

  // --- Save ---

  async function handleSave() {
    setIsSaving(true);
    try {
      // Save form metadata
      const metaRes = await fetch(`/api/forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, settings: form.settings }),
      });
      if (!metaRes.ok) {
        const err = await metaRes.json();
        throw new Error(err.error || "Failed to save form");
      }

      // Bulk save steps
      const stepsRes = await fetch(`/api/forms/${form.id}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: steps.map((s) => ({
            title: s.title,
            description: s.description || null,
            fields: s.fields,
            step_type: s.step_type || "fields",
            options: s.options || null,
            next_step: s.next_step ?? null,
          })),
        }),
      });
      if (!stepsRes.ok) {
        const err = await stepsRes.json();
        throw new Error(err.error || "Failed to save steps");
      }

      const { data: savedSteps } = await stepsRes.json();

      // Update local state with server-generated IDs
      if (savedSteps && savedSteps.length > 0) {
        const selectedIndex = steps.findIndex((s) => s.id === selectedStepId);
        setSteps(savedSteps);
        if (selectedIndex >= 0 && selectedIndex < savedSteps.length) {
          setSelectedStepId(savedSteps[selectedIndex].id);
        } else if (savedSteps.length > 0) {
          setSelectedStepId(savedSteps[0].id);
        }
      }

      setHasUnsavedChanges(false);
      toast.success("Form saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  // --- Deploy ---

  async function handleDeploy() {
    // Auto-save before deploying
    if (hasUnsavedChanges) {
      await handleSave();
      // If save failed, hasUnsavedChanges will still be true
      if (hasUnsavedChanges) return;
    }

    setIsDeploying(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/deploy`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Deploy failed");
      }

      const data = await res.json();
      setForm((prev) => ({ ...prev, status: "active" }));

      if (data.warning === "bot_unreachable") {
        toast.warning("Deployed but bot is unreachable -- it will pick up changes on next restart");
      } else {
        toast.success("Form deployed to Discord");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Deploy failed";
      toast.error(message);
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3 bg-chalk flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/forms"
            className="text-ink/40 hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Input
            value={form.name}
            onChange={(e) => handleFormNameChange(e.target.value)}
            className="text-lg font-black uppercase tracking-wide border-0 border-b-2 border-transparent hover:border-ink focus:border-ink bg-transparent px-1 w-64"
          />
          <span
            className="px-2 py-0.5 text-xs font-black uppercase tracking-wide border-2 border-ink"
            style={{
              backgroundColor: statusColors.bg,
              color: statusColors.text,
            }}
          >
            {form.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="bg-ink text-chalk border-2 border-ink font-black uppercase tracking-wide hover:bg-ink/80 disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="bg-pop-lime text-ink border-2 border-ink font-black uppercase tracking-wide hover:bg-pop-lime/80 disabled:opacity-40"
          >
            {isDeploying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            Deploy
          </Button>
        </div>
      </div>

      {/* Unsaved changes indicator — subtle, inline with header */}
      {hasUnsavedChanges && (
        <div className="bg-ink/5 border-b border-ink/10 px-4 py-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">
            ● Unsaved changes
          </span>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Step List + Settings */}
        <div className="w-72 border-r-2 border-ink bg-chalk overflow-y-auto p-4 flex-shrink-0">
          {/* Apply Channel */}
          <div className="mb-4 pb-3 border-b-2 border-ink/10">
            <label className="text-xs font-black uppercase tracking-wide text-ink block mb-1">
              Apply Channel ID
            </label>
            <Input
              value={form.settings?.apply_channel_id || ""}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, apply_channel_id: e.target.value },
                }));
                markDirty();
              }}
              placeholder="Right-click channel → Copy ID"
              className="text-xs font-bold border-2 border-ink bg-chalk"
            />
            <p className="text-[10px] text-ink/40 mt-1">
              Channel where &quot;Apply Now&quot; embed is posted
            </p>
          </div>

          {/* Intro Message */}
          <div className="mb-4 pb-3 border-b-2 border-ink/10">
            <label className="text-xs font-black uppercase tracking-wide text-ink block mb-1">
              Intro Message
            </label>
            <textarea
              value={form.settings?.intro_message || ""}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, intro_message: e.target.value },
                }));
                markDirty();
              }}
              placeholder="Welcome! We'll walk you through the application step by step..."
              rows={3}
              className="w-full text-xs font-bold border-2 border-ink bg-chalk px-2 py-1.5 resize-none placeholder:font-normal placeholder:italic placeholder:text-ink/30"
            />
            <p className="text-[10px] text-ink/40 mt-1">
              Shown when a user starts an application
            </p>
          </div>

          {/* Completion Message */}
          <div className="mb-4 pb-3 border-b-2 border-ink/10">
            <label className="text-xs font-black uppercase tracking-wide text-ink block mb-1">
              Completion Message
            </label>
            <textarea
              value={form.settings?.completion_message || ""}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, completion_message: e.target.value },
                }));
                markDirty();
              }}
              placeholder="Thanks for applying! We'll review your application and be in touch soon 🎉"
              rows={3}
              className="w-full text-xs font-bold border-2 border-ink bg-chalk px-2 py-1.5 resize-none placeholder:font-normal placeholder:italic placeholder:text-ink/30"
            />
            <p className="text-[10px] text-ink/40 mt-1">
              Shown after submission is confirmed
            </p>
          </div>

          <StepList
            steps={steps}
            selectedStepId={selectedStepId}
            onSelect={setSelectedStepId}
            onReorder={handleReorderSteps}
            onDelete={handleDeleteStep}
            onAdd={() => handleAddStep()}
          />
        </div>

        {/* Column 2: Field Editor / Select Editor */}
        <div className="flex-1 overflow-y-auto p-6 bg-chalk/50">
          {selectedStep ? (
            <FieldEditor
              step={selectedStep}
              steps={steps}
              onTitleChange={handleStepTitleChange}
              onDescriptionChange={handleStepDescriptionChange}
              onFieldsChange={handleFieldsChange}
              onNextStepChange={handleNextStepChange}
              onCreateStep={(title, asBranchTarget) => handleAddStep(title, false, asBranchTarget)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-ink/40 font-bold text-sm mb-2">
                  No step selected
                </p>
                <Button
                  variant="outline"
                  onClick={() => handleAddStep()}
                  className="border-2 border-dashed border-ink font-black uppercase tracking-wide text-xs hover:bg-pop-lime hover:border-solid"
                >
                  Add your first step
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Discord Preview */}
        <div className="w-80 border-l-2 border-ink bg-chalk overflow-y-auto p-4 flex-shrink-0">
          {selectedStep ? (
            <DiscordPreview step={selectedStep} />
          ) : (
            <div className="flex items-center justify-center h-full text-ink/40 text-sm font-bold">
              Select a step to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
