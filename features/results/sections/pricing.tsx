"use client";

import { SimpleBar } from "../charts-lazy";
import type { DashboardStats } from "../compute";
import { Panel } from "../panel";
import type { NarrativePayload } from "../schemas";

export function Pricing({
  stats,
  narrative,
  labels,
}: {
  stats: DashboardStats;
  narrative: NarrativePayload | null;
  labels: Record<string, string>;
}) {
  return (
    <Panel eyebrow="Pricing" title="How the listed price landed">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Price reaction</p>
          <SimpleBar
            data={[
              { name: "Too cheap", n: stats.byPrice.too_cheap },
              { name: "Fair", n: stats.byPrice.fair },
              { name: "Expensive", n: stats.byPrice.expensive },
              { name: "Unaffordable", n: stats.byPrice.unaffordable },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Simulated willingness to pay</p>
          <SimpleBar data={stats.wtp.histogram.map((b) => ({ name: b.label, n: b.n }))} />
          <p className="mt-2 text-xs text-muted-foreground">
            Mean {stats.wtp.mean ?? "—"} · median {stats.wtp.median ?? "—"} · from stored willingness_to_pay
          </p>
        </div>
      </div>
      {stats.bySegment.length > 1 && (
        <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {stats.bySegment.map((s) => (
            <li key={s.key}>
              {labels[s.key] ?? s.key}: fair {s.byPrice.fair} · expensive {s.byPrice.expensive} · unaffordable {s.byPrice.unaffordable}
            </li>
          ))}
        </ul>
      )}
      {narrative && <p className="text-sm text-pretty">{narrative.pricingTakeaway}</p>}
    </Panel>
  );
}
