"use client";

import { FormStep } from "@/lib/types";

interface DiscordPreviewProps {
  step: FormStep;
}

function BotMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-xs font-bold">F</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-semibold text-white">Formie</span>
          <span className="text-[10px] font-medium bg-[#5865F2] text-white px-1 py-0.5 rounded">
            BOT
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-full bg-[#3BA55C] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-xs font-bold">U</span>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-semibold text-[#3BA55C]">User</span>
        </div>
        <p className="text-sm text-[#DBDEE1]">{text}</p>
      </div>
    </div>
  );
}

function ButtonPreview({
  labels,
  style = "secondary",
}: {
  labels: string[];
  style?: "secondary" | "success";
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {labels.map((label, i) => (
        <span
          key={i}
          className={`text-xs font-medium px-3 py-1.5 rounded ${
            style === "success"
              ? "bg-[#3BA55C] text-white"
              : "bg-[#4E5058] text-[#DBDEE1]"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function DiscordPreview({ step }: DiscordPreviewProps) {
  const fields = step.fields || [];

  return (
    <div className="border-2 border-ink brutalist-shadow overflow-hidden">
      {/* Brutalist label */}
      <div className="bg-ink px-3 py-1.5">
        <span className="text-xs font-black uppercase tracking-wide text-pop-lime">
          Discord Preview
        </span>
        <span className="text-[10px] font-bold text-chalk/40 ml-2 uppercase">
          Thread
        </span>
      </div>

      {/* Thread header */}
      <div className="bg-[#2B2D31] px-4 py-2 border-b border-[#1E1F22]">
        <div className="flex items-center gap-1.5">
          <span className="text-[#B5BAC1] text-xs">#</span>
          <span className="text-sm font-semibold text-white truncate">
            {step.title || "Application Thread"}
          </span>
        </div>
      </div>

      {/* Thread conversation */}
      <div className="bg-[#313338] p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* Section header */}
        <BotMessage>
          <div className="bg-[#2B2D31] border-l-4 border-[#5865F2] px-3 py-2 rounded-r">
            <p className="text-sm font-semibold text-white">
              📋 {step.title || "Untitled Step"}
            </p>
          </div>
        </BotMessage>

        {fields.length === 0 && (
          <div className="text-center py-6 text-[#4E5058] text-sm">
            No fields added yet
          </div>
        )}

        {fields.map((field, i) => {
          if (field.type === "short" || field.type === "paragraph") {
            return (
              <div key={field.key} className="space-y-3">
                <BotMessage>
                  <p className="text-sm text-[#DBDEE1]">
                    <strong>{field.label}</strong>
                    {field.required && (
                      <span className="text-red-400 text-xs ml-1">*</span>
                    )}
                  </p>
                  {field.placeholder && (
                    <p className="text-xs text-[#4E5058] italic mt-0.5">
                      {field.placeholder}
                    </p>
                  )}
                  <p className="text-xs text-[#4E5058] mt-1">
                    (Type your answer below 👇)
                  </p>
                </BotMessage>
                {i < fields.length - 1 && (
                  <UserMessage text="Example answer..." />
                )}
              </div>
            );
          }

          if (field.type === "singleselect") {
            const optionLabels = (field.options || []).map((o) => o.label);
            return (
              <div key={field.key} className="space-y-3">
                <BotMessage>
                  <p className="text-sm text-[#DBDEE1]">
                    <strong>{field.label}</strong>
                    {field.required && (
                      <span className="text-red-400 text-xs ml-1">*</span>
                    )}
                  </p>
                  {optionLabels.length > 0 ? (
                    <ButtonPreview labels={optionLabels} />
                  ) : (
                    <p className="text-xs text-[#4E5058] mt-1 italic">
                      No options added yet
                    </p>
                  )}
                </BotMessage>
              </div>
            );
          }

          if (field.type === "multiselect") {
            const optionLabels = (field.options || []).map((o) => o.label);
            return (
              <div key={field.key} className="space-y-3">
                <BotMessage>
                  <p className="text-sm text-[#DBDEE1]">
                    <strong>{field.label}</strong>
                    {field.required && (
                      <span className="text-red-400 text-xs ml-1">*</span>
                    )}
                  </p>
                  <p className="text-xs text-[#4E5058] mt-0.5">
                    Select everything that applies, then hit Done →
                  </p>
                  {optionLabels.length > 0 ? (
                    <>
                      <ButtonPreview labels={optionLabels} />
                      <ButtonPreview labels={["Done →"]} style="success" />
                    </>
                  ) : (
                    <p className="text-xs text-[#4E5058] mt-1 italic">
                      No options added yet
                    </p>
                  )}
                </BotMessage>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
