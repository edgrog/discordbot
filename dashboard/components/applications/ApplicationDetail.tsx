"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PartnerApplication, CategoryType, CATEGORY_LABELS } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ApplicationDetailProps {
  application: PartnerApplication;
  onClose: () => void;
  onStatusChange: (id: number, newStatus: string) => void;
}

export function ApplicationDetail({
  application: app,
  onClose,
  onStatusChange,
}: ApplicationDetailProps) {
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/applications/${app.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });

      const data = await res.json();

      if (data.error === "already_reviewed") {
        toast.info(
          `Already ${data.currentStatus} — refreshing...`
        );
        onStatusChange(app.id, data.currentStatus);
        return;
      }

      if (!data.ok) {
        toast.error(data.error || "Action failed");
        return;
      }

      if (data.warning === "bot_unreachable") {
        toast.warning(
          "Status updated but Discord actions may need manual follow-up"
        );
      } else {
        toast.success(
          `Submission ${action === "approve" ? "approved" : "rejected"}`
        );
      }

      onStatusChange(app.id, action === "approve" ? "approved" : "rejected");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  // Build personal details
  const personalFields = [
    { label: "Email", value: app.email },
    { label: "Phone", value: app.phone },
    { label: "Date of Birth", value: app.dob },
    {
      label: "Location",
      value: [app.address, app.city, app.state, app.zip, app.country]
        .filter(Boolean)
        .join(", "),
    },
  ];

  // Build category answers
  const skipKeys = new Set([
    "category",
    "existingApps",
    "full_name",
    "email",
    "phone",
    "dob",
    "address",
    "city",
    "state",
    "zip",
    "country",
  ]);

  const categoryAnswers = Object.entries(app.answers || {})
    .filter(([key]) => !skipKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: String(value),
    }));

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-chalk border-l-2 border-ink brutalist-shadow z-50 flex flex-col transform transition-transform duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b-2 border-ink">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-ink">
            {app.full_name || "Unknown"}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <CategoryBadge category={app.category as CategoryType} />
            <StatusBadge status={app.status} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-ink/40 hover:text-pop-pink p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Discord */}
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-ink/50 mb-1">Discord</p>
          <p className="text-sm font-bold text-ink">
            {app.discord_username || app.discord_id}
          </p>
        </div>

        {/* Submitted */}
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-ink/50 mb-1">Submitted</p>
          <p className="text-sm font-bold text-ink">
            {format(new Date(app.created_at), "PPpp")} (
            {formatDistanceToNow(new Date(app.created_at), {
              addSuffix: true,
            })}
            )
          </p>
        </div>

        {/* Personal Details */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-3">
            Personal Details
          </h3>
          <div className="space-y-2">
            {personalFields.map((f) => (
              <div key={f.label}>
                <p className="text-xs font-black uppercase tracking-wide text-ink/50">{f.label}</p>
                <p className="text-sm font-bold text-ink">{f.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Category Answers */}
        {categoryAnswers.length > 0 && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-3">
              {CATEGORY_LABELS[app.category as CategoryType] || app.category}{" "}
              Details
            </h3>
            <div className="space-y-2">
              {categoryAnswers.map((a) => (
                <div key={a.key}>
                  <p className="text-xs font-black uppercase tracking-wide text-ink/50">{a.label}</p>
                  <p className="text-sm font-bold text-ink whitespace-pre-wrap">
                    {a.value || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DM Status */}
        {app.status !== "pending" && !app.dm_sent && (
          <div className="bg-pop-orange/10 border-2 border-pop-orange p-3">
            <p className="text-sm font-bold text-pop-orange">
              DM was not sent — submitter may have DMs closed
            </p>
          </div>
        )}

        {/* Review Section */}
        {app.status === "pending" ? (
          <div className="border-t-2 border-ink pt-6">
            <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-3">
              Review
            </h3>
            <Textarea
              placeholder="Add a note to include in the DM... (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              className="mb-2 border-2 border-ink rounded-none bg-white font-bold text-ink"
              rows={3}
            />
            <p className="text-xs font-bold text-ink/40 mb-4">{note.length}/500</p>

            <div className="flex gap-3">
              <Button
                onClick={() => handleAction("approve")}
                disabled={isLoading}
                className="flex-1 bg-pop-lime text-ink font-black uppercase tracking-wide border-2 border-ink rounded-none brutalist-shadow hover:bg-pop-lime/80"
              >
                Approve
              </Button>
              <Button
                onClick={() => handleAction("reject")}
                disabled={isLoading}
                className="flex-1 bg-pop-pink text-white font-black uppercase tracking-wide border-2 border-ink rounded-none brutalist-shadow hover:bg-pop-pink/80"
              >
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t-2 border-ink pt-6">
            <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-3">
              Review Decision
            </h3>
            <p className="text-sm font-bold text-ink/70">
              <span className="font-black">Reviewed by:</span>{" "}
              {app.reviewed_by || "Unknown"}
            </p>
            {app.review_note && (
              <p className="text-sm font-bold text-ink/70 mt-2">
                <span className="font-black">Note:</span> {app.review_note}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
