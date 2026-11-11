"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClusterStat } from "../cluster";
import { Panel } from "../panel";

export function Objections({
  clusters,
  labels,
}: {
  clusters: ClusterStat[];
  labels: Record<string, string>;
}) {
  const [segment, setSegment] = useState("all");
  const shown = useMemo(() => {
    if (segment === "all") return clusters;
    return clusters
      .map((c) => {
        const hit = c.segments.find((s) => s.key === segment)?.count ?? 0;
        return { ...c, count: hit };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [clusters, segment]);

  const segs = [...new Set(clusters.flatMap((c) => c.segments.map((s) => s.key)))];

  return (
    <Panel
      eyebrow="Objections"
      title="Likely objections, clustered"
      action={
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger size="sm" className="w-44" aria-label="Filter objections by segment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All segments</SelectItem>
            {segs.map((k) => (
              <SelectItem key={k} value={k}>
                {labels[k] ?? k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <ul className="space-y-4">
        {shown.map((c) => (
          <li key={c.key} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{c.label}</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {c.count} · {c.pct}% of this view
              </p>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {c.quotes.slice(0, 3).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </li>
        ))}
        {!shown.length && <p className="text-sm text-muted-foreground">No objections in this slice.</p>}
      </ul>
      <p className="text-xs text-muted-foreground">
        Theme names come from the model. Counts and percents are tallied from stored objection text.
      </p>
    </Panel>
  );
}
