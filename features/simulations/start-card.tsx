"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { estimateSimulationJob, formatCost, formatDuration } from "./cost";
import { startSimulation } from "./actions";

export function StartSimulationCard({
  experimentId,
  personaCount,
  mockMode,
}: {
  experimentId: string;
  personaCount: number;
  mockMode: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const estimate = estimateSimulationJob(personaCount, mockMode);
  const disabled = personaCount < 1;

  async function run() {
    if (disabled) return;
    setBusy(true);
    const res = await startSimulation(experimentId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    router.push(`/experiments/${experimentId}/simulate`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Run simulation</p>
        <p className="text-sm text-muted-foreground">
          {personaCount.toLocaleString("en-US")} personas
          {estimate.extrapolated > 0
            ? ` · ${estimate.anchors.toLocaleString("en-US")} in full detail, ${estimate.extrapolated.toLocaleString("en-US")} extrapolated`
            : ""}
          {" · "}
          {formatCost(estimate.estimatedCostCents, estimate.mock)}
          {" · "}
          {formatDuration(estimate.estimatedSeconds, estimate.estimatedMinutes)}
        </p>
      </div>
      <Button size="lg" onClick={run} disabled={disabled || busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        Start simulation
        <ArrowRight />
      </Button>
    </div>
  );
}
