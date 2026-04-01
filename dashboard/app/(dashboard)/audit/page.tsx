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
  approve: "bg-[#BFFF00]/20 text-ink border-2 border-ink font-bold",
  reject: "bg-[#FF3366]/20 text-ink border-2 border-ink font-bold",
  form_edit: "bg-[#3366FF]/20 text-ink border-2 border-ink font-bold",
  user_invite: "bg-[#8B5CF6]/20 text-ink border-2 border-ink font-bold",
  user_remove: "bg-[#FF6B00]/20 text-ink border-2 border-ink font-bold",
  settings_update: "bg-chalk text-ink border-2 border-ink font-bold",
  user_role_change: "bg-[#00D4FF]/20 text-ink border-2 border-ink font-bold",
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
    if (!meta) return <span className="text-ink/40 font-bold">No details</span>;

    return (
      <pre className="font-mono text-xs bg-ink text-[#BFFF00] p-3 overflow-x-auto whitespace-pre-wrap border-2 border-ink">
        {JSON.stringify(meta, null, 2)}
      </pre>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Log" description="Track all Formie dashboard actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {/* TODO: export */}}
          className="border-2 border-ink rounded-none font-black uppercase text-xs hover:bg-ink hover:text-white transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={actionFilter} onValueChange={(v) => v && setActionFilter(v)}>
          <SelectTrigger className="w-40 border-2 border-ink rounded-none font-bold text-xs uppercase">
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
          className="w-36 h-9 border-2 border-ink rounded-none font-mono text-xs"
        />
        <span className="text-xs font-black uppercase text-ink/40">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-36 h-9 border-2 border-ink rounded-none font-mono text-xs"
        />
      </div>

      {/* Table */}
      <div className="bg-card border-2 border-ink brutalist-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-ink bg-chalk">
              <TableHead className="w-8"></TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Timestamp</TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">User</TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Action</TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <>
                <TableRow
                  key={entry.id}
                  className="cursor-pointer hover:bg-[#BFFF00]/10 border-b border-ink/10 transition-colors"
                  onClick={() =>
                    setExpandedId(
                      expandedId === entry.id ? null : entry.id
                    )
                  }
                >
                  <TableCell>
                    {expandedId === entry.id ? (
                      <ChevronDown className="w-4 h-4 text-ink/50" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-ink/50" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink/70">
                    {format(new Date(entry.created_at), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink/60">
                    {entry.user_email || "System"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-none text-xs uppercase ${ACTION_COLORS[entry.action] || "border-2 border-ink font-bold"}`}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink/60">
                    {entry.target_type}
                    {entry.target_id && ` #${entry.target_id}`}
                  </TableCell>
                </TableRow>
                {expandedId === entry.id && (
                  <TableRow key={`${entry.id}-detail`}>
                    <TableCell colSpan={5} className="bg-chalk p-4">
                      {renderMeta(entry.meta)}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-ink/40 font-black uppercase tracking-wide">
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
          className="border-2 border-ink rounded-none font-black uppercase text-xs hover:bg-ink hover:text-white transition-colors"
        >
          Previous
        </Button>
        <span className="text-xs font-black uppercase tracking-wide text-ink/50">Page {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => setPage(page + 1)}
          className="border-2 border-ink rounded-none font-black uppercase text-xs hover:bg-ink hover:text-white transition-colors"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
