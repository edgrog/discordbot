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
        className="flex items-center gap-1 hover:text-gray-900"
      >
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          No applications found
        </h3>
        <p className="text-sm text-gray-500">
          Try adjusting your filters or share the /apply command in Discord
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {isAdmin && (
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            </TableHead>
          )}
          <TableHead>
            <SortHeader field="full_name">Name</SortHeader>
          </TableHead>
          <TableHead>
            <SortHeader field="category">Category</SortHeader>
          </TableHead>
          <TableHead>Discord</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>
            <SortHeader field="created_at">Submitted</SortHeader>
          </TableHead>
          <TableHead>
            <SortHeader field="status">Status</SortHeader>
          </TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app.id}
            className="cursor-pointer hover:bg-gray-50"
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
            <TableCell className="font-medium">
              {app.full_name || "—"}
            </TableCell>
            <TableCell>
              <CategoryBadge category={app.category as CategoryType} />
            </TableCell>
            <TableCell className="text-gray-600">
              {app.discord_username || app.discord_id}
            </TableCell>
            <TableCell className="text-gray-600">
              {[app.city, app.state].filter(Boolean).join(", ") || "—"}
            </TableCell>
            <TableCell className="text-gray-600">
              {formatDistanceToNow(new Date(app.created_at), {
                addSuffix: true,
              })}
            </TableCell>
            <TableCell>
              <StatusBadge status={app.status} />
            </TableCell>
            <TableCell>
              <span className="text-sm text-gray-500 hover:text-gray-900">
                Review &rarr;
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
