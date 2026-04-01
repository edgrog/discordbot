"use client";

import { useState, useEffect, useCallback } from "react";
import { PartnerApplication } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ApplicationFilters } from "@/components/applications/ApplicationFilters";
import { ApplicationsTable } from "@/components/applications/ApplicationsTable";
import { ApplicationDetail } from "@/components/applications/ApplicationDetail";
import { BulkActions } from "@/components/applications/BulkActions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ApplicationsClientProps {
  initialData: PartnerApplication[];
  isAdmin: boolean;
}

export function ApplicationsClient({
  initialData,
  isAdmin,
}: ApplicationsClientProps) {
  const [applications, setApplications] =
    useState<PartnerApplication[]>(initialData);
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedApp, setSelectedApp] = useState<PartnerApplication | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  const fetchApplications = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("partner_applications")
      .select("*")
      .order(sortField, { ascending: sortDir === "asc" })
      .limit(50);

    if (filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.category !== "all") {
      query = query.eq("category", filters.category);
    }
    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte("created_at", filters.dateTo + "T23:59:59");
    }
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,discord_username.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
      );
    }

    const { data } = await query;
    if (data) setApplications(data as PartnerApplication[]);
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

  function handleStatusChange(id: number, newStatus: string) {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus as PartnerApplication["status"] } : a))
    );
    if (selectedApp?.id === id) {
      setSelectedApp({ ...selectedApp, status: newStatus as PartnerApplication["status"] });
    }
  }

  async function handleExport() {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.search) params.set("search", filters.search);

    window.open(`/api/applications/export?${params.toString()}`);
  }

  return (
    <div>
      <PageHeader title="Submissions" description="Review Formie submissions">
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

      <ApplicationFilters filters={filters} onChange={setFilters} />

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
