"use client";

import { useState, useEffect, useCallback } from "react";
import { Submission, Form } from "@/lib/types";
import { ApplicationFilters } from "@/components/applications/ApplicationFilters";
import { ApplicationsTable } from "@/components/applications/ApplicationsTable";
import { ApplicationDetail } from "@/components/applications/ApplicationDetail";
import { BulkActions } from "@/components/applications/BulkActions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ApplicationsClientProps {
  initialData: Submission[];
  forms: Form[];
  isAdmin: boolean;
}

export function ApplicationsClient({
  initialData,
  forms,
  isAdmin,
}: ApplicationsClientProps) {
  const [applications, setApplications] =
    useState<Submission[]>(initialData);
  const [filters, setFilters] = useState({
    status: "all",
    formId: "all",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedApp, setSelectedApp] = useState<Submission | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  const fetchApplications = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.formId !== "all") params.set("formId", filters.formId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.search) params.set("search", filters.search);
    params.set("sortField", sortField);
    params.set("sortDir", sortDir);

    try {
      const res = await fetch(`/api/submissions?${params.toString()}`);
      if (!res.ok) return;
      const { data } = await res.json();
      if (data) setApplications(data as Submission[]);
    } catch {
      // Silently fail — initial data still shown
    }
  }, [filters, sortField, sortDir]);

  useEffect(() => {
    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(fetchApplications, 300);
    setSearchTimeout(timeout);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortField, sortDir]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function handleStatusChange(id: string, newStatus: string) {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus as Submission["status"] } : a))
    );
    if (selectedApp?.id === id) {
      setSelectedApp({ ...selectedApp, status: newStatus as Submission["status"] });
    }
  }

  async function handleExport() {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.formId !== "all") params.set("formId", filters.formId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.search) params.set("search", filters.search);

    window.open(`/api/submissions/export?${params.toString()}`);
  }

  return (
    <div>
      <PageHeader title="SUBMISSIONS" description="Review Formie submissions">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="border-2 border-ink rounded-none font-black uppercase tracking-wide brutalist-shadow hover:bg-pop-lime/20 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </PageHeader>

      <ApplicationFilters filters={filters} onChange={setFilters} forms={forms} />

      {isAdmin && (
        <BulkActions
          selectedCount={selectedIds.size}
          selectedIds={Array.from(selectedIds)}
          onComplete={() => {
            setSelectedIds(new Set());
            fetchApplications();
          }}
        />
      )}

      <div className="bg-card border-2 border-ink brutalist-shadow overflow-hidden">
        <ApplicationsTable
          applications={applications}
          selectedIds={selectedIds}
          onSelectIds={setSelectedIds}
          onRowClick={setSelectedApp}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          isAdmin={isAdmin}
        />
      </div>

      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
