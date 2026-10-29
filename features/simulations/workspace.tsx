"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WizardProgress } from "@/features/ideas/wizard/wizard-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cancelSimulation, pollSimulationJob, resumeSimulation } from "./actions";
import { CompleteView } from "./complete/complete-view";
import type { SimulationSnapshot } from "./job-types";
import { SimulationView } from "./progress/simulation-view";
import { StartSimulationCard } from "./start-card";

export function SimulationWorkspace({
  experimentId,
  audienceHref,
  mockMode,
  personaCount,
  initialJob,
}: {
  experimentId: string;
  audienceHref: string;
  mockMode: boolean;
  personaCount: number;
  initialJob: SimulationSnapshot | null;
}) {
  const [job, setJob] = useState(initialJob);

  const jobId = job?.jobId;
  const live =
    job &&
    (job.status === "queued" || job.status === "simulating" || job.status === "extrapolating");

  useEffect(() => {
    if (!live || !jobId) return;
    let alive = true;
    const tick = async () => {
      const res = await pollSimulationJob(jobId);
      if (!alive || !res.ok) return;
      setJob(res.snapshot);
    };
    const id = setInterval(() => void tick(), 700);
    const kick = setTimeout(() => void tick(), 180);
    return () => {
      alive = false;
      clearInterval(id);
      clearTimeout(kick);
    };
  }, [live, jobId]);

  async function resume() {
    const res = await resumeSimulation(experimentId);
    if (!res.ok) return toast.error(res.error);
    const snap = await pollSimulationJob(res.jobId);
    if (snap.ok) setJob(snap.snapshot);
  }

  return (
    <div className="space-y-8">
      <WizardProgress current={4} />

      {job?.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>Simulation didn&apos;t finish</AlertTitle>
          <AlertDescription>{job.error ?? "Try again. Reactions already stored are kept."}</AlertDescription>
        </Alert>
      )}

      {!job && (
        <div className="space-y-4">
          <div>
            <p className="text-eyebrow-caps">Simulation</p>
            <h1 className="font-display text-title">Run the simulation</h1>
            <p className="text-muted-foreground">Each persona reacts in batches of 25. You can cancel and resume.</p>
          </div>
          <StartSimulationCard experimentId={experimentId} personaCount={personaCount} mockMode={mockMode} />
        </div>
      )}

      {job && (live || job.status === "cancelled") && (
        <SimulationView
          snapshot={job}
          mockMode={mockMode}
          onCancel={async () => {
            const res = await cancelSimulation(job.jobId);
            if (!res.ok) return toast.error(res.error);
            setJob((j) => (j ? { ...j, status: "cancelled", stage: "cancelled" } : j));
            toast("Stopped. Stored reactions are kept.");
          }}
          onResume={job.status === "cancelled" ? resume : undefined}
        />
      )}

      {job?.status === "complete" && (
        <CompleteView snapshot={job} mockMode={mockMode} experimentId={experimentId} audienceHref={audienceHref} />
      )}

      {job?.status === "failed" && (
        <StartSimulationCard experimentId={experimentId} personaCount={personaCount} mockMode={mockMode} />
      )}
    </div>
  );
}
