"use client";

import { Input } from "@/components/ui/input";
import { Form } from "@/lib/types";
import { Search } from "lucide-react";

interface FiltersState {
  status: string;
  formId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface ApplicationFiltersProps {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
  forms: Form[];
}

const STATUS_OPTIONS = ["all", "pending", "approved", "rejected"];

export function ApplicationFilters({
  filters,
  onChange,
  forms,
}: ApplicationFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Status Pills */}
      <div className="flex border-2 border-ink overflow-hidden">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onChange({ ...filters, status: s })}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors border-r-2 border-ink last:border-r-0 ${
              filters.status === s
                ? "bg-pop-lime text-ink"
                : "bg-chalk text-ink/60 hover:bg-pop-lime/20"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Form Selector Dropdown */}
      <select
        value={filters.formId}
        onChange={(e) => onChange({ ...filters, formId: e.target.value })}
        className="h-8 px-3 text-xs font-black uppercase tracking-wide border-2 border-ink bg-chalk text-ink rounded-none appearance-none cursor-pointer hover:bg-pop-blue/20 transition-colors"
      >
        <option value="all">All Forms</option>
        {forms.map((form) => (
          <option key={form.id} value={form.id}>
            {form.name}
          </option>
        ))}
      </select>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          className="h-8 text-xs w-32 border-2 border-ink rounded-none bg-white font-bold text-ink"
        />
        <span className="text-xs font-black uppercase tracking-wide text-ink/40">to</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          className="h-8 text-xs w-32 border-2 border-ink rounded-none bg-white font-bold text-ink"
        />
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
        <Input
          placeholder="Search Discord username..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9 h-8 text-sm border-2 border-ink rounded-none bg-white font-bold text-ink"
        />
      </div>
    </div>
  );
}
