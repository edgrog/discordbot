"use client";

import { FormStep } from "@/lib/types";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface StepListProps {
  steps: FormStep[];
  selectedStepId: string | null;
  onSelect: (id: string) => void;
  onReorder: (steps: FormStep[]) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

function SortableStepItem({
  step,
  isSelected,
  onSelect,
  onDelete,
}: {
  step: FormStep;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 border-2 transition-colors ${
        isSelected
          ? "bg-ink text-chalk border-ink"
          : "bg-chalk text-ink border-transparent hover:border-ink"
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={`px-1.5 py-2.5 cursor-grab active:cursor-grabbing flex-shrink-0 ${
          isSelected ? "text-chalk/40 hover:text-chalk" : "text-ink/40 hover:text-ink"
        }`}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Step Content */}
      <button
        onClick={onSelect}
        className="flex-1 text-left py-2 pr-1"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold truncate">
            {step.position + 1}. {step.title}
          </span>
          <span
            className={`text-xs font-black ml-2 flex-shrink-0 ${
              isSelected ? "text-chalk/60" : "text-ink/40"
            }`}
          >
            {step.fields.length}f
          </span>
        </div>
      </button>

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger
          className={`px-1.5 py-2.5 flex-shrink-0 transition-colors ${
            isSelected
              ? "text-chalk/40 hover:text-pop-pink"
              : "text-ink/40 hover:text-pop-pink"
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete step?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{step.title}&rdquo; and all its fields. This
              can&apos;t be undone once saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-pop-pink hover:bg-pop-pink/80 text-white border-2 border-ink font-black uppercase tracking-wide"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function StepList({
  steps,
  selectedStepId,
  onSelect,
  onReorder,
  onDelete,
  onAdd,
}: StepListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);

    onReorder(arrayMove(steps, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-black uppercase tracking-wide text-ink">
          Steps
        </span>
        <span className="text-xs font-bold text-ink/40">
          {steps.length}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {steps.map((step) => (
              <SortableStepItem
                key={step.id}
                step={step}
                isSelected={step.id === selectedStepId}
                onSelect={() => onSelect(step.id)}
                onDelete={() => onDelete(step.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        onClick={onAdd}
        className="w-full border-2 border-dashed border-ink bg-chalk font-black uppercase tracking-wide text-xs hover:bg-pop-lime hover:text-ink hover:border-solid"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Step
      </Button>
    </div>
  );
}
