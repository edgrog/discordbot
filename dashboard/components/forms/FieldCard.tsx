"use client";

import { FormField, FieldOption, FormStep } from "@/lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, Lock, Plus, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FieldCardProps {
  field: FormField;
  isLocked: boolean;
  steps: FormStep[];
  currentStepPosition: number;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
}

const MAX_LABEL = 45;
const MAX_PLACEHOLDER = 100;
const MAX_OPTIONS = 25;

const FIELD_TYPES: { value: FormField["type"]; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "paragraph", label: "Long" },
  { value: "singleselect", label: "Select" },
  { value: "multiselect", label: "Multi" },
];

export function FieldCard({
  field,
  isLocked,
  steps,
  currentStepPosition,
  onUpdate,
  onRemove,
}: FieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelectType = field.type === "singleselect" || field.type === "multiselect";
  const options = field.options || [];

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    const ts = Date.now();
    onUpdate({
      options: [
        ...options,
        { label: "New Option", value: `option_${ts}` },
      ],
    });
  }

  function updateOption(index: number, updates: Partial<FieldOption>) {
    onUpdate({
      options: options.map((o, i) =>
        i === index ? { ...o, ...updates } : o
      ),
    });
  }

  function removeOption(index: number) {
    onUpdate({ options: options.filter((_, i) => i !== index) });
  }

  return (
    <TooltipProvider>
      <div
        ref={setNodeRef}
        style={style}
        className="bg-card border-2 border-ink p-4 brutalist-shadow-sm"
      >
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-2 cursor-grab text-ink/40 hover:text-ink active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Field Content */}
          <div className="flex-1 space-y-3">
            {/* Label */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-ink">
                    Label
                  </span>
                  {isLocked && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="w-3 h-3 text-pop-orange" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-52">
                          This field has validation logic hardcoded in the bot —
                          label and placeholder can be edited, but the field
                          cannot be removed
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <span
                  className={`text-xs font-bold ${
                    field.label.length >= MAX_LABEL
                      ? "text-pop-pink font-black"
                      : "text-ink/40"
                  }`}
                >
                  {field.label.length}/{MAX_LABEL}
                </span>
              </div>
              <Input
                value={field.label}
                onChange={(e) =>
                  onUpdate({ label: e.target.value.slice(0, MAX_LABEL) })
                }
                className="text-sm font-bold border-2 border-ink bg-chalk"
              />
            </div>

            {/* Type Selector — 4 options */}
            <div>
              <span className="text-xs font-black uppercase tracking-wide text-ink block mb-1">
                Type
              </span>
              <div className="flex border-2 border-ink overflow-hidden">
                {FIELD_TYPES.map((ft, i) => (
                  <button
                    key={ft.value}
                    onClick={() => {
                      const updates: Partial<FormField> = { type: ft.value };
                      // Initialize options when switching to select type
                      if (
                        (ft.value === "singleselect" || ft.value === "multiselect") &&
                        !field.options?.length
                      ) {
                        updates.options = [];
                      }
                      // Clear options when switching away
                      if (ft.value === "short" || ft.value === "paragraph") {
                        updates.options = undefined;
                        updates.branching = undefined;
                      }
                      onUpdate(updates);
                    }}
                    className={`flex-1 px-2 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
                      i > 0 ? "border-l-2 border-ink" : ""
                    } ${
                      field.type === ft.value
                        ? "bg-ink text-chalk"
                        : "bg-chalk text-ink hover:bg-pop-lime"
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Placeholder (text types only) */}
            {!isSelectType && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase tracking-wide text-ink">
                    Placeholder
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      (field.placeholder?.length || 0) >= MAX_PLACEHOLDER
                        ? "text-pop-pink font-black"
                        : "text-ink/40"
                    }`}
                  >
                    {field.placeholder?.length || 0}/{MAX_PLACEHOLDER}
                  </span>
                </div>
                <Input
                  value={field.placeholder || ""}
                  onChange={(e) =>
                    onUpdate({
                      placeholder: e.target.value.slice(0, MAX_PLACEHOLDER),
                    })
                  }
                  placeholder="Optional placeholder text..."
                  className="text-sm font-bold border-2 border-ink bg-chalk"
                />
              </div>
            )}

            {/* Options Editor (select types) */}
            {isSelectType && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide text-ink">
                    Options
                  </span>
                  <span className="text-xs font-bold text-ink/40">
                    {options.length}/{MAX_OPTIONS}
                  </span>
                </div>

                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink/30 w-4 text-right">
                      {idx + 1}
                    </span>
                    <Input
                      value={opt.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const value = label
                          .toLowerCase()
                          .replace(/\s+/g, "_")
                          .replace(/[^a-z0-9_]/g, "");
                        updateOption(idx, { label, value });
                      }}
                      placeholder="Option label"
                      className="flex-1 text-xs font-bold border-2 border-ink bg-white py-1"
                    />

                    {/* Per-option routing (singleselect with branching only) */}
                    {field.type === "singleselect" && field.branching && (
                      <select
                        value={
                          opt.next_step === null || opt.next_step === undefined
                            ? "next"
                            : opt.next_step === -1
                            ? "end"
                            : String(opt.next_step)
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const ns =
                            val === "next"
                              ? null
                              : val === "end"
                              ? -1
                              : parseInt(val);
                          updateOption(idx, { next_step: ns });
                        }}
                        className="text-[10px] font-bold border-2 border-ink bg-white px-1 py-1 w-28"
                      >
                        <option value="next">Next</option>
                        <option value="end">End</option>
                        {steps
                          .filter((s) => s.position !== currentStepPosition)
                          .map((s) => (
                            <option key={s.id} value={s.position}>
                              Step {s.position + 1}
                            </option>
                          ))}
                      </select>
                    )}

                    <button
                      onClick={() => removeOption(idx)}
                      className="text-ink/30 hover:text-pop-pink"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addOption}
                  disabled={options.length >= MAX_OPTIONS}
                  className="w-full border-2 border-dashed border-ink/30 bg-white font-bold text-xs py-1 h-auto hover:bg-pop-lime hover:border-ink"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Option
                </Button>

                {/* Branching toggle (singleselect only) */}
                {field.type === "singleselect" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-ink/10">
                    <Switch
                      checked={field.branching || false}
                      onCheckedChange={(checked) =>
                        onUpdate({ branching: checked })
                      }
                    />
                    <span className="text-xs font-black uppercase tracking-wide text-ink">
                      Branching
                    </span>
                    <span className="text-[10px] text-ink/40">
                      Route to different steps per option
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Required + Delete row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.required}
                  onCheckedChange={(checked) =>
                    onUpdate({ required: checked })
                  }
                />
                <span className="text-xs font-black uppercase tracking-wide text-ink">Required</span>
              </div>

              {!isLocked && (
                <AlertDialog>
                  <AlertDialogTrigger className="text-ink/40 hover:text-pop-pink transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete field?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove &ldquo;{field.label}&rdquo; from this step. This
                        can&apos;t be undone once saved.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onRemove}
                        className="bg-pop-pink hover:bg-pop-pink/80 text-white border-2 border-ink font-black uppercase tracking-wide"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
