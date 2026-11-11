"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateComparison } from "./actions";
import type { ComparisonNumbers } from "./compare-compute";
import type { ComparisonNarrative } from "./schemas";

export function CompareView({
  experimentId,
  experimentName,
  seed,
  numbers,
  narrative: initialNarrative,
}: {
  experimentId: string;
  experimentName: string;
  seed: number;
  numbers: ComparisonNumbers;
  narrative: ComparisonNarrative | null;
}) {
  const [narrative, setNarrative] = useState(initialNarrative);
  const [busy, setBusy] = useState(!initialNarrative && numbers.variants.length >= 2);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (narrative || numbers.variants.length < 2) return;
    let gone = false;
    void generateComparison(experimentId).then((res) => {
      if (gone) return;
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNarrative(res.narrative);
    });
    return () => {
      gone = true;
    };
  }, [experimentId, narrative, numbers.variants.length]);

  if (numbers.variants.length < 2) {
    return (
      <div className="space-y-6">
        <Header name={experimentName} seed={seed} experimentId={experimentId} />
        <p className="text-sm text-muted-foreground">
          Run at least two variants against the same personas to compare. Control plus B is enough.
        </p>
        <Button asChild>
          <Link href={`/experiments/${experimentId}/variants`}>Open variants</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header name={experimentName} seed={seed} experimentId={experimentId} />

      {numbers.smallDifference && (
        <Alert>
          <AlertTitle>Uncertain difference</AlertTitle>
          <AlertDescription>{numbers.uncertaintyNote}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-subheading font-medium">Simulated interest</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Variant</th>
                <th className="py-2 pr-3 font-medium">n</th>
                <th className="py-2 pr-3 font-medium">Mean interest</th>
                <th className="py-2 pr-3 font-medium">Δ vs Control</th>
                <th className="py-2 pr-3 font-medium">Interested %</th>
                <th className="py-2 font-medium">Expensive / unaffordable %</th>
              </tr>
            </thead>
            <tbody>
              {numbers.variants.map((v) => {
                const delta = numbers.deltas.find((d) => d.variantId === v.id);
                return (
                  <tr key={v.id} className="border-b">
                    <td className="py-2 pr-3">
                      {v.label}
                      {v.isControl ? <span className="text-muted-foreground"> · Control</span> : null}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{v.n}</td>
                    <td className="py-2 pr-3 tabular-nums">{v.meanInterest ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {v.isControl ? (
                        "—"
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="tabular-nums">{fmtDelta(delta?.meanDelta)}</span>
                          {delta?.uncertain && <Badge variant="outline">Uncertain</Badge>}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{v.interestedPct}%</td>
                    <td className="py-2 tabular-nums">{v.expensivePct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-subheading font-medium">Segment winners and losers</h2>
        {numbers.segmentWinners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Segment means sit close together on this run.</p>
        ) : (
          <ul className="space-y-2">
            {numbers.segmentWinners.map((s) => (
              <li key={s.key} className="rounded-lg border p-3 text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {s.winnerLabel} ahead of {s.loserLabel} by {s.spread} simulated interest points
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-subheading font-medium">Objection mix</h2>
          {numbers.objectionDiffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Objection rates did not move much between variants.</p>
          ) : (
            <ul className="space-y-2">
              {numbers.objectionDiffs.map((o) => (
                <li key={o.text} className="rounded-lg border p-3 text-sm">
                  <p>{o.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Object.entries(o.byLabel)
                      .map(([label, pct]) => `${label} ${pct}%`)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-subheading font-medium">Pricing mix</h2>
          <ul className="space-y-2">
            {numbers.priceDiffs.map((p) => (
              <li key={p.reaction} className="rounded-lg border p-3 text-sm">
                <p className="capitalize">{p.reaction.replace("_", " ")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Object.entries(p.byLabel)
                    .map(([label, pct]) => `${label} ${pct}%`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-subheading font-medium">Why they differ</h2>
        {busy && !narrative && <p className="text-sm text-muted-foreground">Writing a note around the numbers…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {narrative && (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {narrative.headlines.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p className="text-sm text-pretty">{narrative.whyTheyDiffer}</p>
            <p className="text-sm text-muted-foreground">{narrative.caution}</p>
          </>
        )}
      </section>
    </div>
  );
}

function Header({ name, seed, experimentId }: { name: string; seed: number; experimentId: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-eyebrow-caps">Comparison</p>
        <h1 className="font-display text-title">{name}</h1>
        <p className="text-muted-foreground">Same seed {seed} and the same personas. Numbers are counted from stored reactions.</p>
        <div className="mt-2">
          <SimulatedBadge />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/experiments/${experimentId}/variants`}>Edit variants</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/experiments/${experimentId}/results`}>Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

function fmtDelta(n: number | null | undefined) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}`;
}
