"use client";

import { FormStep, FormField } from "@/lib/types";
import { FieldCard } from "./FieldCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface FieldEditorProps {
  step: FormStep;
  steps: FormStep[];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onFieldsChange: (fields: FormField[]) => void;
  onNextStepChange: (next_step: number | null) => void;
  onCreateStep: (title?: string, asBranchTarget?: boolean) => number;
}

const LOCKED_KEYS = ["dob", "email"];
const MAX_FIELDS = 20;
const MAX_TITLE_LENGTH = 45;
const MAX_DESCRIPTION_LENGTH = 500;

export function FieldEditor({
  step,
  steps,
  onTitleChange,
  onDescriptionChange,
  onFieldsChange,
  onNextStepChange,
  onCreateStep,
}: FieldEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = step.fields.findIndex((f) => f.key === active.id);
    const newIndex = step.fields.findIndex((f) => f.key === over.id);

    onFieldsChange(arrayMove(step.fields, oldIndex, newIndex));
  }

  function updateField(key: string, updates: Partial<FormField>) {
    onFieldsChange(
      step.fields.map((f) => (f.key === key ? { ...f, ...updates } : f))
    );
  }

  function removeField(key: string) {
    onFieldsChange(step.fields.filter((f) => f.key !== key));
  }

  function addField() {
    if (step.fields.length >= MAX_FIELDS) return;

    const newKey = `field_${Date.now()}`;
    onFieldsChange([
      ...step.fields,
      {
        key: newKey,
        label: "New Field",
        type: "short",
        required: false,
      },
    ]);
  }

  const atLimit = step.fields.length >= MAX_FIELDS;

  return (
      <div className="space-y-6">
        {/* Step Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-ink">
              Step Title
            </label>
            <span
              className={`text-xs font-bold ${
                step.title.length >= MAX_TITLE_LENGTH
                  ? "text-pop-pink font-black"
                  : "text-ink/40"
              }`}
            >
              {step.title.length}/{MAX_TITLE_LENGTH}
            </span>
          </div>
          <Input
            value={step.title}
            onChange={(e) =>
              onTitleChange(e.target.value.slice(0, MAX_TITLE_LENGTH))
            }
            className="text-lg font-bold border-2 border-ink bg-chalk focus:ring-pop-lime"
          />
        </div>

        {/* Step Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-ink">
              Step Description
            </label>
            <span
              className={`text-xs font-bold ${
                (step.description?.length || 0) >= MAX_DESCRIPTION_LENGTH
                  ? "text-pop-pink font-black"
                  : "text-ink/40"
              }`}
            >
              {step.description?.length || 0}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>
          <textarea
            value={step.description || ""}
            onChange={(e) =>
              onDescriptionChange(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))
            }
            placeholder="Optional instructions or context shown before questions in this step..."
            rows={2}
            className="w-full text-sm font-bold border-2 border-ink bg-chalk px-3 py-2 resize-none focus:ring-pop-lime focus:outline-none"
          />
        </div>

        {/* Fields header with counter */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wide text-ink">
            Fields
          </label>
          <span
            className={`text-xs font-bold ${
              atLimit ? "text-pop-pink font-black" : "text-ink/40"
            }`}
          >
            {step.fields.length}/{MAX_FIELDS}
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={step.fields.map((f) => f.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {step.fields.map((field) => (
                <FieldCard
                  key={field.key}
                  field={field}
                  isLocked={LOCKED_KEYS.includes(field.key)}
                  steps={steps}
                  currentStepPosition={step.position}
                  onUpdate={(updates) => updateField(field.key, updates)}
                  onRemove={() => removeField(field.key)}
                  onCreateStep={onCreateStep}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add Field */}
        <div>
          <Button
            variant="outline"
            onClick={addField}
            disabled={atLimit}
            className="w-full border-2 border-dashed border-ink bg-chalk font-black uppercase tracking-wide hover:bg-pop-lime hover:text-ink hover:border-solid"
            title={atLimit ? "Max 20 fields per step — split into multiple steps for longer sections" : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Field {atLimit && `(${MAX_FIELDS} max)`}
          </Button>
        </div>

        {/* Next Step Routing */}
        {steps.length > 1 && (
          <div className="border-t-2 border-ink/10 pt-4">
            <label className="text-xs font-black uppercase tracking-wide text-ink block mb-1.5">
              After this step, go to:
            </label>
            <select
              value={
                step.next_step === null
                  ? "next"
                  : step.next_step === -1
                  ? "end"
                  : String(step.next_step)
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === "next") onNextStepChange(null);
                else if (val === "end") onNextStepChange(-1);
                else if (val === "__new__") {
                  const pos = onCreateStep(undefined, true);
                  onNextStepChange(pos);
                } else onNextStepChange(parseInt(val));
              }}
              className="w-full text-sm font-bold border-2 border-ink bg-chalk px-3 py-2"
            >
              <option value="next">→ Next in order</option>
              <option value="end">⏹ End form (submit)</option>
              {steps
                .filter((s) => s.position !== step.position)
                .map((s) => (
                  <option key={s.id} value={s.position}>
                    → [{s.position + 1}] {s.title || "Untitled"}
                  </option>
                ))}
              <option value="__new__">+ Create new step</option>
            </select>
          </div>
        )}
      </div>
  );
}
