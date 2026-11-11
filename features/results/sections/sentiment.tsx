"use client";

import { SimpleBar } from "../charts-lazy";
import type { DashboardStats } from "../compute";
import { Panel } from "../panel";

export function Sentiment({ stats }: { stats: DashboardStats }) {
  return (
    <Panel eyebrow="Sentiment" title="How the scores spread">
      <SimpleBar data={stats.sentiment.map((s) => ({ name: s.label, n: s.n }))} />
      <p className="text-xs text-muted-foreground">
        Bands are cut from stored interest scores: ignoring 0–24, cool 25–44, mixed 45–64, warm 65–79, hot 80–100.
      </p>
    </Panel>
  );
}
