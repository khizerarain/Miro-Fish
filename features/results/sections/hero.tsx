"use client";

import { SimulatedBadge } from "@/components/simulated-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IntentBars } from "../charts-lazy";
import type { DashboardStats } from "../compute";
import type { NarrativePayload } from "../schemas";

export function Hero({
  stats,
  narrative,
  name,
  filtered,
}: {
  stats: DashboardStats;
  narrative: NarrativePayload | null;
  name: string;
  filtered: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Research dashboard</p>
          <h1 className="font-display text-title">{name}</h1>
          <p className="text-muted-foreground">
            {stats.n.toLocaleString("en-US")} stored reactions
            {stats.extrapolated > 0 ? ` · ${stats.extrapolated.toLocaleString("en-US")} labeled extrapolated` : ""}
            {filtered ? " · filtered view" : ""}
          </p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-xl border px-5 py-3">
              <p className="text-xs text-muted-foreground">Mean simulated interest</p>
              <p className="font-display text-display tabular-nums">{stats.meanInterest ?? "—"}</p>
              <p className="text-xs text-muted-foreground">of 100 · from stored scores, not a forecast</p>
            </div>
          </TooltipTrigger>
          <TooltipContent>Average of interest_score on the rows in this filter. The LLM does not produce this number.</TooltipContent>
        </Tooltip>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-eyebrow-caps mb-2">Purchase intent</p>
          <IntentBars
            data={[
              { name: "None", n: stats.byIntent.none },
              { name: "Low", n: stats.byIntent.low },
              { name: "Med", n: stats.byIntent.medium },
              { name: "High", n: stats.byIntent.high },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            none {stats.intentPct.none}% · low {stats.intentPct.low}% · medium {stats.intentPct.medium}% · high {stats.intentPct.high}%
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-eyebrow-caps mb-3">Headline findings</p>
          {narrative ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              {narrative.headlines.map((h) => (
                <li key={h.text}>
                  <p>{h.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tied to {h.evidence}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Notes still generating. The numbers on the left are already from stored reactions.</p>
          )}
          {filtered && narrative && (
            <p className="mt-3 text-xs text-muted-foreground">Headline notes describe the full simulated run. Counts above follow your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
