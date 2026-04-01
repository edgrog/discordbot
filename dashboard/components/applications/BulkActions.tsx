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
      toast.success(`${succeeded} application${succeeded !== 1 ? "s" : ""} ${action}d`);
    } else {
      toast.warning(`${succeeded} succeeded, ${failed} failed`);
    }

    onComplete();
  }

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="text-sm font-medium text-gray-700">
        {selectedCount} selected
      </span>

      {isProcessing ? (
        <span className="text-sm text-gray-500">{progress}</span>
      ) : (
        <>
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-green-600 hover:bg-green-700 text-white">
                Approve {selectedCount}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve {selectedCount} applications?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will approve all selected applications, assign Discord
                  roles, and send DMs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleBulk("approve")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-red-600 hover:bg-red-700 text-white">
                Reject {selectedCount}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject {selectedCount} applications?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reject all selected applications and send decline DMs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleBulk("reject")}
                  className="bg-red-600 hover:bg-red-700"
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
