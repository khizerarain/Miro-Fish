"use client";

import { motion, useReducedMotion } from "motion/react";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCost } from "../cost";
import type { SimulationSnapshot } from "../job-types";

const STAGES = [
  { id: "queued", label: "Queued" },
  { id: "simulating", label: "Simulating" },
  { id: "extrapolating", label: "Extrapolating" },
  { id: "complete", label: "Complete" },
] as const;

export function SimulationView({
  snapshot,
  mockMode,
  onCancel,
  onResume,
}: {
  snapshot: SimulationSnapshot;
  mockMode: boolean;
  onCancel: () => void;
  onResume?: () => void;
}) {
  const reduce = useReducedMotion();
  const pct = snapshot.total ? Math.round((snapshot.completed / snapshot.total) * 100) : 0;
  const cancelled = snapshot.status === "cancelled";
  const running = snapshot.status === "queued" || snapshot.status === "simulating" || snapshot.status === "extrapolating";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Simulation</p>
          <h1 className="font-display text-title">{cancelled ? "Simulation paused" : "Reactions coming in"}</h1>
          <p className="text-muted-foreground">
            {snapshot.completed.toLocaleString("en-US")} of {snapshot.total.toLocaleString("en-US")} stored
            {snapshot.tally.extrapolated > 0 ? ` · ${snapshot.tally.extrapolated.toLocaleString("en-US")} extrapolated` : ""}
          </p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <div className="flex gap-2">
          {running && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {cancelled && onResume && (
            <Button onClick={onResume}>Resume</Button>
          )}
        </div>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Simulation stages">
        {STAGES.map((s) => {
          const active = snapshot.stage === s.id;
          const done =
            STAGES.findIndex((x) => x.id === snapshot.stage) > STAGES.findIndex((x) => x.id === s.id) ||
            snapshot.stage === "complete";
          return (
            <li key={s.id}>
              <Badge variant={active ? "default" : done ? "secondary" : "outline"}>{s.label}</Badge>
            </li>
          );
        })}
      </ol>

      <div className="space-y-2">
        <Progress value={pct} />
        <p className="text-xs text-muted-foreground">
          {pct}% complete · {formatCost(snapshot.actualCostCents, mockMode)}
        </p>
      </div>

      <Tally snapshot={snapshot} />

      {snapshot.positivityWarning && (
        <p className="text-sm text-muted-foreground">{snapshot.positivityWarning}</p>
      )}

      <div>
        <p className="text-eyebrow-caps mb-3">Latest reactions</p>
        <ul className="space-y-3">
          {snapshot.samples.map((s) => (
            <motion.li
              key={s.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{s.personaName}</p>
                <span className="text-sm tabular-nums text-muted-foreground">{s.interestScore}</span>
              </div>
              <p className="mt-1 text-sm text-pretty">{s.firstImpression}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {s.purchaseIntent} intent
                {s.isExtrapolated ? " · extrapolated" : ""}
                {s.wouldRecommend ? " · would mention it" : ""}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tally({ snapshot }: { snapshot: SimulationSnapshot }) {
  const t = snapshot.tally;
  const n = t.stored || 1;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">Mean simulated interest</p>
        <p className="text-2xl font-medium tabular-nums">{t.meanInterest ?? "—"}</p>
      </div>
      <div className="rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">Purchase intent</p>
        <p className="text-sm">
          none {t.byIntent.none} · low {t.byIntent.low} · med {t.byIntent.medium} · high {t.byIntent.high}
        </p>
      </div>
      <div className="rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">Would mention it</p>
        <p className="text-2xl font-medium tabular-nums">{Math.round((t.recommendYes / n) * 100)}%</p>
        <p className="text-xs text-muted-foreground">of stored reactions, not a forecast</p>
      </div>
    </div>
  );
}
