"use client";

import { SimpleBar, StackedHeat } from "../charts-lazy";
import type { DashboardStats } from "../compute";
import { Panel } from "../panel";

export function Segments({
  stats,
  labels,
  onSelect,
}: {
  stats: DashboardStats;
  labels: Record<string, string>;
  onSelect: (segmentKey: string) => void;
}) {
  const named = stats.bySegment.map((s) => ({
    ...s,
    name: labels[s.key] ?? s.key,
  }));
  const most = named[0];
  const ignoring = [...named].sort((a, b) => b.ignoringPct - a.ignoringPct)[0];
  const hostile = [...named].sort((a, b) => b.hostilePct - a.hostilePct)[0];

  return (
    <Panel eyebrow="Segments" title="Who leaned in, who ignored it">
      <p className="text-sm text-muted-foreground">Click a segment bar to filter the whole dashboard.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <SimpleBar
          data={named.map((s) => ({ name: s.name, n: s.meanInterest ?? 0 }))}
          yKey="n"
          onBarClick={(name) => {
            const hit = named.find((s) => s.name === name);
            if (hit) onSelect(hit.key);
          }}
        />
        <StackedHeat
          rows={named.map((s) => ({
            name: s.name,
            interested: s.interested,
            ignoring: s.ignoring,
            hostile: s.hostile,
          }))}
        />
      </div>
      <ul className="grid gap-3 text-sm sm:grid-cols-3">
        <li className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Most interested</p>
          <p className="font-medium">{most ? labels[most.key] ?? most.key : "—"}</p>
          <p className="text-xs text-muted-foreground">{most ? `mean ${most.meanInterest ?? "—"} · n=${most.n}` : ""}</p>
        </li>
        <li className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Ignoring</p>
          <p className="font-medium">{ignoring ? labels[ignoring.key] ?? ignoring.key : "—"}</p>
          <p className="text-xs text-muted-foreground">{ignoring ? `${ignoring.ignoringPct}% of that segment scored under 25` : ""}</p>
        </li>
        <li className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Hostile</p>
          <p className="font-medium">{hostile ? labels[hostile.key] ?? hostile.key : "—"}</p>
          <p className="text-xs text-muted-foreground">{hostile ? `${hostile.hostilePct}% none intent and score under 40` : ""}</p>
        </li>
      </ul>
    </Panel>
  );
}
