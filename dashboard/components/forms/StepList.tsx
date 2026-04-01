"use client";

import { FormConfig, CATEGORY_COLORS } from "@/lib/types";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StepListProps {
  formData: FormConfig[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

const CATEGORY_ORDER = ["personal", "creator", "artist", "bar", "club"] as const;

const CATEGORY_DISPLAY: Record<string, string> = {
  personal: "Personal (all categories)",
  creator: "Content Creator",
  artist: "Artist",
  bar: "Bar / Venue",
  club: "Club / Organiser",
};

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  personal: "#FFD700",
  creator: CATEGORY_COLORS.creator,
  artist: CATEGORY_COLORS.artist,
  bar: CATEGORY_COLORS.bar,
  club: CATEGORY_COLORS.club,
};

export function StepList({ formData, selectedKey, onSelect }: StepListProps) {
  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      acc[cat] = formData
        .filter((c) => c.category === cat)
        .sort((a, b) => a.step - b.step);
      return acc;
    },
    {} as Record<string, FormConfig[]>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const steps = grouped[cat];
          if (!steps || steps.length === 0) return null;

          return (
            <div key={cat}>
              <div
                className="flex items-center gap-1.5 mb-2 pl-2"
                style={{ borderLeft: `3px solid ${CATEGORY_BORDER_COLORS[cat]}` }}
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {CATEGORY_DISPLAY[cat]}
                </span>
                {cat === "personal" && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-48">
                        These steps apply to every application category
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-0.5">
                {steps.map((step) => {
                  const key = `${step.category}_${step.step}`;
                  const isActive = key === selectedKey;

                  return (
                    <button
                      key={key}
                      onClick={() => onSelect(key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          Step {step.step} &middot; {step.step_title}
                        </span>
                        <span className="text-xs text-gray-400">
                          {step.fields.length}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
