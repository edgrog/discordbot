"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FiltersState {
  status: string;
  category: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface ApplicationFiltersProps {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
}

const STATUS_OPTIONS = ["all", "pending", "approved", "rejected"];
const CATEGORY_OPTIONS = ["all", "creator", "artist", "club", "bar"];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  creator: "Creator",
  artist: "Artist",
  club: "Club",
  bar: "Bar",
};

export function ApplicationFilters({
  filters,
  onChange,
}: ApplicationFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Status Pills */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onChange({ ...filters, status: s })}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.status === s
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Category Pills */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ ...filters, category: c })}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.category === c
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          className="h-8 text-xs w-32"
        />
        <span className="text-xs text-gray-400">to</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          className="h-8 text-xs w-32"
        />
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search name, email, Discord..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9 h-8 text-sm"
        />
      </div>
    </div>
  );
}
