"use client";

import { AUDIENCE_SIZES } from "../constants";
import { formatCost, formatDuration, type estimatePersonaJob } from "../cost";
import { cn } from "@/lib/utils";

type Estimate = ReturnType<typeof estimatePersonaJob>;

export function SizePicker({
  size,
  estimates,
  onChange,
}: {
  size: number;
  estimates: Record<number, Estimate>;
  onChange: (n: number) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Audience size</legend>
      <div className="grid gap-3 sm:grid-cols-4">
        {AUDIENCE_SIZES.map((n) => {
          const est = estimates[n];
          const selected = n === size;
          return (
            <label
              key={n}
              className={cn(
                "cursor-pointer rounded-xl border p-4 shadow-soft transition-colors",
                selected ? "border-primary bg-brand-soft/40" : "hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="audience-size"
                className="sr-only"
                checked={selected}
                onChange={() => onChange(n)}
              />
              <p className="font-medium">{n.toLocaleString("en-US")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {est ? `${formatCost(est.estimatedCostCents, est.mock)} · ${formatDuration(est.estimatedSeconds, est.estimatedMinutes)}` : "—"}
              </p>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
