"use client";

import { PartnerApplication, CategoryType } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown } from "lucide-react";

interface ApplicationsTableProps {
  applications: PartnerApplication[];
  selectedIds: Set<number>;
  onSelectIds: (ids: Set<number>) => void;
  onRowClick: (app: PartnerApplication) => void;
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  isAdmin: boolean;
}

export function ApplicationsTable({
  applications,
  selectedIds,
  onSelectIds,
  onRowClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sortField,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sortDir,
  onSort,
  isAdmin,
}: ApplicationsTableProps) {
  const allSelected =
    applications.length > 0 &&
    applications.every((a) => selectedIds.has(a.id));

  function toggleAll() {
    if (allSelected) {
      onSelectIds(new Set());
    } else {
      onSelectIds(new Set(applications.map((a) => a.id)));
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectIds(next);
  }

  function SortHeader({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) {
    return (
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 font-black uppercase tracking-wide text-ink hover:text-pop-pink transition-colors"
      >
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-16 bg-chalk">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-black uppercase tracking-wide text-ink mb-1">
          No submissions found
        </h3>
        <p className="text-sm font-bold text-ink/60">
          Try adjusting your filters or share the /apply command in Discord
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b-2 border-ink bg-chalk">
          {isAdmin && (
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            </TableHead>
          )}
          <TableHead className="font-black uppercase tracking-wide text-ink text-xs">
            <SortHeader field="full_name">Name</SortHeader>
          </TableHead>
          <TableHead className="font-black uppercase tracking-wide text-ink text-xs">
            <SortHeader field="category">Category</SortHeader>
          </TableHead>
          <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Discord</TableHead>
          <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Location</TableHead>
          <TableHead className="font-black uppercase tracking-wide text-ink text-xs">
            <SortHeader field="created_at">Submitted</SortHeader>
          </TableHead>
          <TableHead className="font-black uppercase tracking-wide text-ink text-xs">
            <SortHeader field="status">Status</SortHeader>
          </TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app.id}
            className="cursor-pointer border-b-2 border-ink hover:bg-pop-lime/10 transition-colors"
            onClick={() => onRowClick(app)}
          >
            {isAdmin && (
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(app.id)}
                  onCheckedChange={() => toggleOne(app.id)}
                />
              </TableCell>
            )}
            <TableCell className="font-bold text-ink">
              {app.full_name || "—"}
            </TableCell>
            <TableCell>
              <CategoryBadge category={app.category as CategoryType} />
            </TableCell>
            <TableCell className="font-bold text-ink/70">
              {app.discord_username || app.discord_id}
            </TableCell>
            <TableCell className="font-bold text-ink/70">
              {[app.city, app.state].filter(Boolean).join(", ") || "—"}
            </TableCell>
            <TableCell className="font-bold text-ink/70">
              {formatDistanceToNow(new Date(app.created_at), {
                addSuffix: true,
              })}
            </TableCell>
            <TableCell>
              <StatusBadge status={app.status} />
            </TableCell>
            <TableCell>
              <span className="text-sm font-black uppercase tracking-wide text-ink/50 hover:text-pop-pink transition-colors">
                Review &rarr;
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
