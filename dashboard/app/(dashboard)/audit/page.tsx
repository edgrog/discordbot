"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuditLogEntry } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  approve: "bg-green-50 text-green-700 border-green-200",
  reject: "bg-red-50 text-red-700 border-red-200",
  form_edit: "bg-blue-50 text-blue-700 border-blue-200",
  user_invite: "bg-violet-50 text-violet-700 border-violet-200",
  user_remove: "bg-orange-50 text-orange-700 border-orange-200",
  settings_update: "bg-gray-50 text-gray-700 border-gray-200",
  user_role_change: "bg-amber-50 text-amber-700 border-amber-200",
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter, dateFrom, dateTo]);

  async function fetchEntries() {
    const supabase = createClient();
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

    const { data } = await query;
    if (data) {
      setEntries(data as AuditLogEntry[]);
      setHasMore(data.length === PAGE_SIZE);
    }
  }

  function renderMeta(meta: Record<string, unknown> | null) {
    if (!meta) return <span className="text-gray-400">No details</span>;

    return (
      <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(meta, null, 2)}
      </pre>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Log" description="Track all dashboard actions">
        <Button variant="outline" size="sm" onClick={() => {/* TODO: export */}}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={actionFilter} onValueChange={(v) => v && setActionFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="form_edit">Form Edit</SelectItem>
            <SelectItem value="user_invite">User Invite</SelectItem>
            <SelectItem value="user_remove">User Remove</SelectItem>
            <SelectItem value="settings_update">Settings Update</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-36 h-9"
        />
        <span className="text-xs text-gray-400">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-36 h-9"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <>
                <TableRow
                  key={entry.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedId(
                      expandedId === entry.id ? null : entry.id
                    )
                  }
                >
                  <TableCell>
                    {expandedId === entry.id ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {format(new Date(entry.created_at), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {entry.user_email || "System"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ACTION_COLORS[entry.action] || ""}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {entry.target_type}
                    {entry.target_id && ` #${entry.target_id}`}
                  </TableCell>
                </TableRow>
                {expandedId === entry.id && (
                  <TableRow key={`${entry.id}-detail`}>
                    <TableCell colSpan={5} className="bg-gray-50">
                      {renderMeta(entry.meta)}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                  No audit entries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-gray-500">Page {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
