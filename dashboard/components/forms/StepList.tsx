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
  personal: "#FFE500",
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
      <div className="space-y-5">
        {CATEGORY_ORDER.map((cat) => {
          const steps = grouped[cat];
          if (!steps || steps.length === 0) return null;

          return (
            <div key={cat}>
              <div
                className="flex items-center gap-1.5 mb-2 pl-2 border-l-3"
                style={{ borderLeftColor: CATEGORY_BORDER_COLORS[cat] }}
              >
                <span className="text-xs font-black text-ink uppercase tracking-wide">
                  {CATEGORY_DISPLAY[cat]}
                </span>
                {cat === "personal" && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-ink/40" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-48">
                        These steps apply to every application category
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-1">
                {steps.map((step) => {
                  const key = `${step.category}_${step.step}`;
                  const isActive = key === selectedKey;

                  return (
                    <button
                      key={key}
                      onClick={() => onSelect(key)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors border-2 ${
                        isActive
                          ? "bg-ink text-chalk font-bold border-ink"
                          : "bg-chalk text-ink border-transparent hover:border-ink hover:bg-chalk font-medium"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          Step {step.step} &middot; {step.step_title}
                        </span>
                        <span
                          className={`text-xs font-black ${
                            isActive ? "text-chalk/60" : "text-ink/40"
                          }`}
                        >
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
