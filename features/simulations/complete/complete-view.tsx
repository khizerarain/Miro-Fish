"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCost } from "../cost";
import type { SimulationSnapshot } from "../job-types";
import { StartSimulationCard } from "../start-card";

const EXPLAINER_KEY = "mf-sim-explainer-v1";
const EXPLAINER_EVENT = "mf-sim-explainer";
const explainerStore = {
  subscribe: (cb: () => void) => {
    window.addEventListener(EXPLAINER_EVENT, cb);
    return () => window.removeEventListener(EXPLAINER_EVENT, cb);
  },
  get: () => !window.localStorage.getItem(EXPLAINER_KEY),
};

export function CompleteView({
  snapshot,
  mockMode,
  experimentId,
  audienceHref,
}: {
  snapshot: SimulationSnapshot;
  mockMode: boolean;
  experimentId: string;
  audienceHref: string;
}) {
  const showExplainer = useSyncExternalStore(explainerStore.subscribe, explainerStore.get, () => false);

  const t = snapshot.tally;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Simulation</p>
          <h1 className="font-display text-title">Reactions stored</h1>
          <p className="text-muted-foreground">
            {t.stored.toLocaleString("en-US")} simulated reactions
            {t.extrapolated > 0 ? ` · ${t.extrapolated.toLocaleString("en-US")} labeled extrapolated` : ""}
          </p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{formatCost(snapshot.actualCostCents, mockMode)} used</p>
      </div>

      {showExplainer && (
        <Alert>
          <AlertTitle>Simulated hypotheses, not verified demand</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              These people do not exist. Use the numbers as directional prompts for real interviews and surveys.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.localStorage.setItem(EXPLAINER_KEY, "1");
                window.dispatchEvent(new Event(EXPLAINER_EVENT));
              }}
            >
              Got it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {snapshot.positivityWarning && <p className="text-sm text-muted-foreground">{snapshot.positivityWarning}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Mean simulated interest" value={t.meanInterest == null ? "—" : String(t.meanInterest)} />
        <Stat
          label="Intent mix"
          value={`none ${t.byIntent.none} · low ${t.byIntent.low} · med ${t.byIntent.medium} · high ${t.byIntent.high}`}
        />
        <Stat
          label="Price mix"
          value={`cheap ${t.byPrice.too_cheap} · fair ${t.byPrice.fair} · high ${t.byPrice.expensive} · unaffordable ${t.byPrice.unaffordable}`}
        />
      </div>

      <div>
        <p className="text-eyebrow-caps mb-3">Sample reactions</p>
        <ul className="space-y-3">
          {snapshot.samples.map((s) => (
            <li key={s.id} className="rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex justify-between gap-3">
                <p className="font-medium">{s.personaName}</p>
                <span className="text-sm tabular-nums">{s.interestScore}</span>
              </div>
              <p className="mt-1 text-sm text-pretty">{s.firstImpression}</p>
            </li>
          ))}
        </ul>
      </div>

      <section className="rounded-xl border p-5">
        <h2 className="text-subheading font-medium">How to validate this</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Interview five people in your top segment about the objections that showed up most.</li>
          <li>Run a short survey on price using the same plan names, not these simulated scores.</li>
          <li>Show the ad headline to people who have never heard of you and note what they ignore.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={audienceHref}>Back to audience</Link>
        </Button>
      </div>

      <StartSimulationCard experimentId={experimentId} personaCount={snapshot.total} mockMode={mockMode} />
      <p className="text-xs text-muted-foreground">Running again replaces stored reactions for this experiment.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
