"use client";

import { FormField } from "@/lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Trash2, Lock } from "lucide-react";
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
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
}

const MAX_LABEL = 45;
const MAX_PLACEHOLDER = 100;

export function FieldCard({
  field,
  isLocked,
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

            {/* Type + Placeholder row */}
            <div className="flex items-start gap-4">
              {/* Type Toggle */}
              <div className="flex-shrink-0">
                <span className="text-xs font-black uppercase tracking-wide text-ink block mb-1">
                  Type
                </span>
                <div className="flex border-2 border-ink overflow-hidden">
                  <button
                    onClick={() => onUpdate({ type: "short" })}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
                      field.type === "short"
                        ? "bg-ink text-chalk"
                        : "bg-chalk text-ink hover:bg-pop-lime"
                    }`}
                  >
                    Short
                  </button>
                  <button
                    onClick={() => onUpdate({ type: "paragraph" })}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors border-l-2 border-ink ${
                      field.type === "paragraph"
                        ? "bg-ink text-chalk"
                        : "bg-chalk text-ink hover:bg-pop-lime"
                    }`}
                  >
                    Long
                  </button>
                </div>
              </div>

              {/* Placeholder */}
              <div className="flex-1">
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
            </div>

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
