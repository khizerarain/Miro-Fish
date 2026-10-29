import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureSimulationJobRunning, snapshotSimulationJob } from "@/jobs/simulate-reactions";
import { getActiveSimulationJob, getExperimentForUser, listPersonasForAudience } from "./queries";
import { SimulationWorkspace } from "./workspace";

export async function SimulationLoader({ experimentId }: { experimentId: string }) {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="We couldn't open this experiment"
        description="This experiment no longer exists."
        action={
          <Button asChild>
            <Link href="/experiments">Back to experiments</Link>
          </Button>
        }
      />
    );
  }
  const people = exp.audienceId ? await listPersonasForAudience(exp.audienceId) : [];
  const jobRow = await getActiveSimulationJob(exp.id);
  const initialJob = jobRow ? await snapshotSimulationJob(jobRow.id) : null;
  if (jobRow && (jobRow.status === "queued" || jobRow.status === "simulating")) {
    after(() => ensureSimulationJobRunning(jobRow.id));
  }

  return (
    <SimulationWorkspace
      key={initialJob?.jobId ?? "none"}
      experimentId={exp.id}
      audienceHref={`/experiments/${exp.id}/audience`}
      mockMode={env().MOCK_LLM}
      personaCount={people.length}
      initialJob={initialJob}
    />
  );
}

export function SimulationSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading simulation">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-6 w-full max-w-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
