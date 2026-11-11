"use client";

import { INCOME_BANDS } from "@/features/audiences/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGE_BUCKETS } from "./constants";
import type { DashboardFilters } from "./schemas";

export function FilterBar({
  filters,
  onChange,
  segments,
  disabled,
}: {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  segments: { key: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Dashboard filters">
      <FilterSelect
        label="Segment"
        value={filters.segment}
        disabled={disabled}
        onValueChange={(segment) => onChange({ ...filters, segment })}
        options={[{ value: "all", label: "All segments" }, ...segments.map((s) => ({ value: s.key, label: s.label }))]}
      />
      <FilterSelect
        label="Age"
        value={filters.age}
        disabled={disabled}
        onValueChange={(age) => onChange({ ...filters, age })}
        options={[{ value: "all", label: "All ages" }, ...AGE_BUCKETS.map((b) => ({ value: b, label: b }))]}
      />
      <FilterSelect
        label="Income"
        value={filters.income}
        disabled={disabled}
        onValueChange={(income) => onChange({ ...filters, income })}
        options={[{ value: "all", label: "All incomes" }, ...INCOME_BANDS.map((b) => ({ value: b.id, label: b.label }))]}
      />
      <FilterSelect
        label="Intent"
        value={filters.intent}
        disabled={disabled}
        onValueChange={(intent) => onChange({ ...filters, intent: intent as DashboardFilters["intent"] })}
        options={[
          { value: "all", label: "All intent" },
          { value: "none", label: "None" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-40 bg-background" size="sm" aria-label={`Filter by ${label.toLowerCase()}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
