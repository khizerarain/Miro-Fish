"use client";

import Link from "next/link";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ideaDiff, type RunSnapshot } from "./types";
import type { ComparisonNumbers } from "@/features/variants/compare-compute";

export function RunCompareView({
  a,
  b,
  numbers,
}: {
  a: RunSnapshot;
  b: RunSnapshot;
  numbers: ComparisonNumbers;
}) {
  const diffs = ideaDiff(a.idea, b.idea);
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Run comparison</p>
          <h1 className="font-display text-title">
            {a.name} vs {b.name}
          </h1>
          <p className="text-muted-foreground">What changed in the idea, and how stored simulated scores moved.</p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/experiments">Experiments</Link>
        </Button>
      </div>

      {numbers.smallDifference && numbers.uncertaintyNote && (
        <Alert>
          <AlertTitle>Uncertain difference</AlertTitle>
          <AlertDescription>{numbers.uncertaintyNote}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-2">
        <h2 className="text-subheading font-medium">What changed</h2>
        {diffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Copy and listed price look the same. Audience or seed may still differ.</p>
        ) : (
          <ul className="space-y-2">
            {diffs.map((d) => (
              <li key={d.field} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{d.field}</p>
                <p className="mt-1 text-muted-foreground">Before: {d.before}</p>
                <p className="text-muted-foreground">After: {d.after}</p>
              </li>
            ))}
          </ul>
        )}
        {b.changeSummary && <p className="text-sm">{b.changeSummary}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-subheading font-medium">How results moved</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Run</th>
              <th className="py-2 pr-3 font-medium">n</th>
              <th className="py-2 pr-3 font-medium">Mean interest</th>
              <th className="py-2 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {numbers.variants.map((v) => {
              const delta = numbers.deltas.find((d) => d.variantId === v.id);
              return (
                <tr key={v.id} className="border-b">
                  <td className="py-2 pr-3">{v.label}</td>
                  <td className="py-2 pr-3 tabular-nums">{v.n}</td>
                  <td className="py-2 pr-3 tabular-nums">{v.meanInterest ?? "—"}</td>
                  <td className="py-2 tabular-nums">{v.isControl ? "—" : fmt(delta?.meanDelta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n}`;
}
