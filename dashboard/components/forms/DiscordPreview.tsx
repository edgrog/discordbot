"use client";

import { FormConfig } from "@/lib/types";
import { Lock } from "lucide-react";

const LOCKED_KEYS = ["dob", "email"];

interface DiscordPreviewProps {
  config: FormConfig;
}

export function DiscordPreview({ config }: DiscordPreviewProps) {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg">
      {/* Modal Header */}
      <div className="bg-[#2B2D31] px-4 py-3">
        <h3 className="text-white text-sm font-semibold truncate">
          {config.step_title || "Untitled Step"}
        </h3>
      </div>

      {/* Modal Body */}
      <div className="bg-[#313338] p-4 space-y-4">
        {config.fields.map((field) => {
          const isLocked = LOCKED_KEYS.includes(field.key);

          return (
            <div key={field.key} className="space-y-1.5">
              {/* Label */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wide">
                  {field.label}
                </span>
                {field.required && (
                  <span className="text-red-400 text-xs">*</span>
                )}
                {isLocked && (
                  <Lock className="w-3 h-3 text-amber-400 opacity-60" />
                )}
              </div>

              {/* Input */}
              <div
                className={`bg-[#1E1F22] rounded px-3 py-2 border border-[#3F4147] ${
                  field.type === "paragraph" ? "min-h-[80px]" : "min-h-[36px]"
                }`}
              >
                {field.placeholder && (
                  <span className="text-sm text-[#4E5058]">
                    {field.placeholder}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {config.fields.length === 0 && (
          <div className="text-center py-8 text-[#4E5058] text-sm">
            No fields added yet
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="bg-[#2B2D31] px-4 py-3 flex justify-end gap-2">
        <button className="text-sm text-white hover:underline px-4 py-1.5">
          Cancel
        </button>
        <button className="text-sm bg-[#5865F2] text-white rounded px-4 py-1.5 font-medium">
          Submit
        </button>
      </div>
    </div>
  );
}
