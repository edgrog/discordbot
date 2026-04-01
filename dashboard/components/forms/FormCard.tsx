"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Form, FORM_STATUS_COLORS } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Archive, Trash2, Terminal, Inbox } from "lucide-react";

interface FormCardProps {
  form: Form;
}

export function FormCard({ form }: FormCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const statusColor = FORM_STATUS_COLORS[form.status] || FORM_STATUS_COLORS.draft;

  const createdDate = new Date(form.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleArchive() {
    const newStatus = form.status === "archived" ? "draft" : "archived";
    await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="bg-card border-2 border-ink brutalist-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex flex-col">
      {/* Header */}
      <div className="p-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-black text-ink truncate">
              {form.name}
            </h3>
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border-2 border-ink shrink-0"
              style={{
                backgroundColor: statusColor.bg,
                color: statusColor.text,
              }}
            >
              {form.status}
            </span>
          </div>
          {form.description && (
            <p className="text-sm text-ink/50 font-medium truncate">
              {form.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-1 border-2 border-ink hover:bg-ink/5 transition-colors shrink-0"
          >
            <MoreVertical className="w-4 h-4 text-ink" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-2 border-ink rounded-none brutalist-shadow-sm">
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="w-4 h-4" />
              {form.status === "archived" ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-3 flex items-center gap-4 text-xs text-ink/50 font-semibold">
        <div className="flex items-center gap-1">
          <Inbox className="w-3.5 h-3.5" />
          <span>{form.submission_count ?? 0} submissions</span>
        </div>
        {form.discord_command_name && (
          <div className="flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5" />
            <code className="font-mono text-ink/70">/{form.discord_command_name}</code>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t-2 border-ink/10 px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] text-ink/40 font-medium uppercase tracking-wide">
          {createdDate}
        </span>
        <Link
          href={`/forms/${form.id}`}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#141414] text-white text-xs font-black uppercase tracking-wide border-2 border-[#141414] hover:bg-[#141414]/80 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </Link>
      </div>
    </div>
  );
}
