"use client";

import { FormStep, SelectOption } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SelectEditorProps {
  step: FormStep;
  steps: FormStep[];
  onTitleChange: (title: string) => void;
  onOptionsChange: (options: SelectOption[]) => void;
}

const MAX_TITLE_LENGTH = 45;
const MAX_OPTIONS = 25;

function SortableOptionItem({
  option,
  index,
  steps,
  currentStepPosition,
  onUpdate,
  onRemove,
}: {
  option: SelectOption;
  index: number;
  steps: FormStep[];
  currentStepPosition: number;
  onUpdate: (updates: Partial<SelectOption>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.value || `opt_${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-2 border-ink bg-chalk p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-ink/40 hover:text-ink cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <span className="text-xs font-black text-ink/40 flex-shrink-0 w-5">
          {index + 1}.
        </span>

        <Input
          value={option.label}
          onChange={(e) => {
            const label = e.target.value;
            const value = label
              .toLowerCase()
              .replace(/\s+/g, "_")
              .replace(/[^a-z0-9_]/g, "");
            onUpdate({ label, value });
          }}
          placeholder="Option label"
          className="flex-1 text-sm font-bold border-2 border-ink bg-white"
        />

        <button
          onClick={onRemove}
          className="text-ink/40 hover:text-pop-pink flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Routing */}
      <div className="flex items-center gap-2 pl-9">
        <span className="text-xs font-bold text-ink/50">Routes to:</span>
        <select
          value={option.next_step === null ? "next" : option.next_step === -1 ? "end" : String(option.next_step)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "next") onUpdate({ next_step: null });
            else if (val === "end") onUpdate({ next_step: -1 });
            else onUpdate({ next_step: parseInt(val) });
          }}
          className="text-xs font-bold border-2 border-ink bg-white px-2 py-1 flex-1"
        >
          <option value="next">Next in order</option>
          <option value="end">End form</option>
          {steps
            .filter((s) => s.position !== currentStepPosition)
            .map((s) => (
              <option key={s.id} value={s.position}>
                Step {s.position + 1}: {s.title}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

export function SelectEditor({
  step,
  steps,
  onTitleChange,
  onOptionsChange,
}: SelectEditorProps) {
  const options = step.options || [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = options.findIndex(
      (o) => (o.value || `opt_${options.indexOf(o)}`) === active.id
    );
    const newIndex = options.findIndex(
      (o) => (o.value || `opt_${options.indexOf(o)}`) === over.id
    );

    onOptionsChange(arrayMove(options, oldIndex, newIndex));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    const ts = Date.now();
    onOptionsChange([
      ...options,
      { label: "New Option", value: `option_${ts}`, next_step: null },
    ]);
  }

  function updateOption(index: number, updates: Partial<SelectOption>) {
    onOptionsChange(
      options.map((o, i) => (i === index ? { ...o, ...updates } : o))
    );
  }

  function removeOption(index: number) {
    onOptionsChange(options.filter((_, i) => i !== index));
  }

  const atLimit = options.length >= MAX_OPTIONS;

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-black uppercase tracking-wide text-ink">
            Selection Title
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
        <p className="text-xs text-ink/40 mt-1">
          Users will see a dropdown menu with the options below
        </p>
      </div>

      {/* Options */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black uppercase tracking-wide text-ink">
            Options
          </label>
          <span className="text-xs font-bold text-ink/40">
            {options.length}/{MAX_OPTIONS}
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={options.map((o, i) => o.value || `opt_${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {options.map((option, index) => (
                <SortableOptionItem
                  key={option.value || `opt_${index}`}
                  option={option}
                  index={index}
                  steps={steps}
                  currentStepPosition={step.position}
                  onUpdate={(updates) => updateOption(index, updates)}
                  onRemove={() => removeOption(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          variant="outline"
          onClick={addOption}
          disabled={atLimit}
          className="w-full mt-3 border-2 border-dashed border-ink bg-chalk font-black uppercase tracking-wide hover:bg-pop-lime hover:text-ink hover:border-solid"
          title={atLimit ? "Discord limit: max 25 options" : undefined}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Option {atLimit && "(max 25)"}
        </Button>
      </div>
    </div>
  );
}
