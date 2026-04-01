"use client";

import { FormConfig, FormField } from "@/lib/types";
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
  config: FormConfig;
  onTitleChange: (title: string) => void;
  onFieldsChange: (fields: FormField[]) => void;
}

const LOCKED_KEYS = ["dob", "email"];
const MAX_FIELDS = 5;
const MAX_TITLE_LENGTH = 45;

export function FieldEditor({
  config,
  onTitleChange,
  onFieldsChange,
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

    const oldIndex = config.fields.findIndex((f) => f.key === active.id);
    const newIndex = config.fields.findIndex((f) => f.key === over.id);

    onFieldsChange(arrayMove(config.fields, oldIndex, newIndex));
  }

  function updateField(key: string, updates: Partial<FormField>) {
    onFieldsChange(
      config.fields.map((f) => (f.key === key ? { ...f, ...updates } : f))
    );
  }

  function removeField(key: string) {
    onFieldsChange(config.fields.filter((f) => f.key !== key));
  }

  function addField() {
    if (config.fields.length >= MAX_FIELDS) return;

    const newKey = `field_${Date.now()}`;
    onFieldsChange([
      ...config.fields,
      {
        key: newKey,
        label: "New Field",
        type: "short",
        required: false,
      },
    ]);
  }

  const atLimit = config.fields.length >= MAX_FIELDS;

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
                config.step_title.length >= MAX_TITLE_LENGTH
                  ? "text-pop-pink font-black"
                  : "text-ink/40"
              }`}
            >
              {config.step_title.length}/{MAX_TITLE_LENGTH}
            </span>
          </div>
          <Input
            value={config.step_title}
            onChange={(e) =>
              onTitleChange(e.target.value.slice(0, MAX_TITLE_LENGTH))
            }
            className="text-lg font-bold border-2 border-ink bg-chalk focus:ring-pop-lime"
          />
        </div>

        {/* Fields */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={config.fields.map((f) => f.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {config.fields.map((field) => (
                <FieldCard
                  key={field.key}
                  field={field}
                  isLocked={LOCKED_KEYS.includes(field.key)}
                  onUpdate={(updates) => updateField(field.key, updates)}
                  onRemove={() => removeField(field.key)}
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
            title={atLimit ? "Discord limit: max 5 fields per step" : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Field {atLimit && "(max 5)"}
          </Button>
        </div>
      </div>
  );
}
