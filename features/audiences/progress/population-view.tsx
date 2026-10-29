"use client";

import { motion, useReducedMotion } from "motion/react";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PersonaJobSnapshot } from "../job-types";
import type { AudienceSegment } from "../schemas";

export function PopulationView({
  snapshot,
  segments,
  onCancel,
}: {
  snapshot: PersonaJobSnapshot;
  segments: AudienceSegment[];
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const pct = snapshot.total ? Math.round((snapshot.completed / snapshot.total) * 100) : 0;
  const label = Object.fromEntries(segments.map((s) => [s.key, s.label]));

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-title">Population forming</h1>
            <p className="text-muted-foreground">
              {snapshot.completed.toLocaleString("en-US")} of {snapshot.total.toLocaleString("en-US")} personas
            </p>
            <div className="mt-2">
              <SimulatedBadge />
            </div>
          </div>
          {snapshot.status === "generating" || snapshot.status === "queued" ? (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
        <Progress value={pct} />
        <p className="text-xs text-muted-foreground">{pct}% complete</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {segments
          .filter((s) => s.enabled)
          .map((s) => (
            <li key={s.key} className="rounded-xl border px-4 py-3">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-2xl font-medium tabular-nums">{snapshot.segmentCounts[s.key] ?? 0}</p>
            </li>
          ))}
      </ul>

      <div>
        <p className="text-eyebrow-caps mb-3">Arriving now</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.samples.map((p) => (
            <motion.li
              key={p.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-4 shadow-soft"
            >
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                {p.age} · {p.profession}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {label[p.segmentKey] ?? p.segmentKey} · {p.location}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
