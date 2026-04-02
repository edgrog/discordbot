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

  function handleAddStep() {
    const newStep: FormStep = {
      id: `new_${Date.now()}`,
      form_id: form.id,
      position: steps.length,
      title: "New Step",
      step_type: "fields",
      fields: [],
      options: null,
      next_step: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedStepId(newStep.id);
    markDirty();
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
        body: JSON.stringify({ name: form.name }),
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
    if (hasUnsavedChanges) {
      toast.error("Save your changes before deploying");
      return;
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
            disabled={isDeploying || hasUnsavedChanges}
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

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="bg-pop-lime/20 border-b-2 border-ink px-4 py-2 flex-shrink-0">
          <span className="text-xs font-black uppercase tracking-wide text-ink">
            Unsaved changes
          </span>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Step List */}
        <div className="w-72 border-r-2 border-ink bg-chalk overflow-y-auto p-4 flex-shrink-0">
          <StepList
            steps={steps}
            selectedStepId={selectedStepId}
            onSelect={setSelectedStepId}
            onReorder={handleReorderSteps}
            onDelete={handleDeleteStep}
            onAdd={handleAddStep}
          />
        </div>

        {/* Column 2: Field Editor / Select Editor */}
        <div className="flex-1 overflow-y-auto p-6 bg-chalk/50">
          {selectedStep ? (
            <FieldEditor
              step={selectedStep}
              steps={steps}
              onTitleChange={handleStepTitleChange}
              onFieldsChange={handleFieldsChange}
              onNextStepChange={handleNextStepChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-ink/40 font-bold text-sm mb-2">
                  No step selected
                </p>
                <Button
                  variant="outline"
                  onClick={handleAddStep}
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
