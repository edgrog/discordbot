"use client";

import { useState } from "react";
import { toast } from "sonner";
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

interface BulkActionsProps {
  selectedCount: number;
  selectedIds: number[];
  onComplete: () => void;
}

export function BulkActions({
  selectedCount,
  selectedIds,
  onComplete,
}: BulkActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleBulk(action: "approve" | "reject") {
    setIsProcessing(true);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < selectedIds.length; i++) {
      setProgress(
        `${action === "approve" ? "Approving" : "Rejecting"} ${i + 1} of ${selectedIds.length}...`
      );
      try {
        const res = await fetch(`/api/applications/${selectedIds[i]}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.ok) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setIsProcessing(false);
    setProgress("");

    if (failed === 0) {
      toast.success(`${succeeded} submission${succeeded !== 1 ? "s" : ""} ${action}d`);
    } else {
      toast.warning(`${succeeded} succeeded, ${failed} failed`);
    }

    onComplete();
  }

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-4 p-3 bg-chalk border-2 border-ink brutalist-shadow">
      <span className="text-sm font-black uppercase tracking-wide text-ink">
        {selectedCount} selected
      </span>

      {isProcessing ? (
        <span className="text-sm font-bold text-ink/60">{progress}</span>
      ) : (
        <>
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center justify-center text-sm font-black uppercase tracking-wide h-9 px-4 bg-pop-lime text-ink border-2 border-ink rounded-none brutalist-shadow hover:bg-pop-lime/80 transition-colors">
                Approve {selectedCount}
            </AlertDialogTrigger>
            <AlertDialogContent className="border-2 border-ink rounded-none brutalist-shadow bg-chalk">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase tracking-wide text-ink">Approve {selectedCount} submissions?</AlertDialogTitle>
                <AlertDialogDescription className="font-bold text-ink/60">
                  This will approve all selected submissions, assign Discord
                  roles, and send DMs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-2 border-ink rounded-none font-black uppercase tracking-wide hover:bg-ink/5">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleBulk("approve")}
                  className="bg-pop-lime text-ink border-2 border-ink rounded-none font-black uppercase tracking-wide brutalist-shadow hover:bg-pop-lime/80"
                >
                  Approve All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center justify-center text-sm font-black uppercase tracking-wide h-9 px-4 bg-pop-pink text-white border-2 border-ink rounded-none brutalist-shadow hover:bg-pop-pink/80 transition-colors">
                Reject {selectedCount}
            </AlertDialogTrigger>
            <AlertDialogContent className="border-2 border-ink rounded-none brutalist-shadow bg-chalk">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase tracking-wide text-ink">Reject {selectedCount} submissions?</AlertDialogTitle>
                <AlertDialogDescription className="font-bold text-ink/60">
                  This will reject all selected submissions and send decline DMs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-2 border-ink rounded-none font-black uppercase tracking-wide hover:bg-ink/5">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleBulk("reject")}
                  className="bg-pop-pink text-white border-2 border-ink rounded-none font-black uppercase tracking-wide brutalist-shadow hover:bg-pop-pink/80"
                >
                  Reject All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
