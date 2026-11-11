"use client";

import type { ClusterStat } from "../cluster";
import { Panel } from "../panel";

export function FeatureRequests({ clusters }: { clusters: ClusterStat[] }) {
  return (
    <Panel eyebrow="Feature requests" title="What they asked for, ranked">
      <ol className="space-y-3">
        {clusters.map((c, i) => (
          <li key={c.key} className="flex gap-3 rounded-lg border p-4">
            <span className="text-sm tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{c.label}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {c.count} · {c.pct}%
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{c.phrases.slice(0, 3).map((p) => p.text).join(" · ")}</p>
            </div>
          </li>
        ))}
        {!clusters.length && <p className="text-sm text-muted-foreground">No wanted or missing features in this slice.</p>}
      </ol>
    </Panel>
  );
}
