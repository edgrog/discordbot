"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface CreateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateFormDialog({ open, onOpenChange }: CreateFormDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [commandName, setCommandName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugEdited && name) {
      setSlug(slugify(name));
    }
  }, [name, slugEdited]);

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(slugify(value));
  }

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setDescription("");
    setCommandName("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug || undefined,
          description: description.trim() || undefined,
          discord_command_name: commandName.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create form");
        setSubmitting(false);
        return;
      }

      reset();
      onOpenChange(false);
      router.push(`/forms/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) reset();
        onOpenChange(val);
      }}
    >
      <DialogContent
        className="!rounded-none border-2 border-[#141414] brutalist-shadow !sm:max-w-md bg-[#F5F5F0]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="!font-black !text-lg uppercase tracking-wide text-[#141414]">
            Create Form
          </DialogTitle>
          <DialogDescription className="text-[#141414]/50 font-medium">
            Set up a new form for your Discord server.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-[#141414]">
              Name <span className="text-[#FF3366]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Partner Application"
              required
              className="h-9 w-full border-2 border-[#141414] bg-white px-3 text-sm font-medium text-[#141414] placeholder:text-[#141414]/30 outline-none focus:ring-2 focus:ring-[#BFFF00] transition-shadow"
            />
          </div>

          {/* Slug preview */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-[#141414]">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="auto-generated-from-name"
              className="h-9 w-full border-2 border-[#141414]/30 bg-white px-3 text-sm font-mono text-[#141414]/70 placeholder:text-[#141414]/20 outline-none focus:border-[#141414] focus:ring-2 focus:ring-[#BFFF00] transition-shadow"
            />
            {slug && (
              <p className="text-[11px] text-[#141414]/40 font-medium">
                URL-safe identifier: <code className="font-mono">{slug}</code>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-[#141414]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this form"
              rows={2}
              className="w-full border-2 border-[#141414]/30 bg-white px-3 py-2 text-sm font-medium text-[#141414] placeholder:text-[#141414]/20 outline-none focus:border-[#141414] focus:ring-2 focus:ring-[#BFFF00] transition-shadow resize-none"
            />
          </div>

          {/* Discord Command Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-[#141414]">
              Discord Command Name
            </label>
            <div className="flex items-center border-2 border-[#141414]/30 bg-white focus-within:border-[#141414] focus-within:ring-2 focus-within:ring-[#BFFF00] transition-shadow">
              <span className="pl-3 text-sm font-mono text-[#141414]/40">/</span>
              <input
                type="text"
                value={commandName}
                onChange={(e) =>
                  setCommandName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
                }
                placeholder="apply"
                className="h-9 flex-1 bg-transparent px-1 text-sm font-mono text-[#141414] placeholder:text-[#141414]/20 outline-none"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="border-2 border-[#FF3366] bg-[#FF3366]/10 px-3 py-2 text-sm font-bold text-[#FF3366]">
              {error}
            </div>
          )}

          {/* Actions */}
          <DialogFooter className="!rounded-none !border-t-2 !border-[#141414]/10 !bg-transparent !-mx-4 !-mb-4 !p-4">
            <button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              className="px-4 py-2 text-sm font-black uppercase tracking-wide text-[#141414]/60 border-2 border-[#141414]/20 hover:border-[#141414]/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-white text-sm font-black uppercase tracking-wide border-2 border-[#141414] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#141414]/80 transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Creating..." : "Create Form"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
