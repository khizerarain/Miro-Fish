import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureAudience, getActiveJob, listPersonas, listTemplates, personaCounts } from "./queries";
import { snapshotPersonaJob } from "@/jobs/generate-personas";
import { AudienceWorkspace } from "./workspace";

export async function AudienceLoader({ experimentId }: { experimentId: string }) {
  const user = await requireUser();
  const state = await ensureAudience(user.id, experimentId);
  if (!state) {
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
  const [templates, jobRow, page, charts] = await Promise.all([
    listTemplates(user.id),
    getActiveJob(state.audience.id),
    listPersonas(state.audience.id, { limit: 48 }),
    personaCounts(state.audience.id),
  ]);
  const initialJob = jobRow ? await snapshotPersonaJob(jobRow.id) : null;

  return (
    <AudienceWorkspace
      experimentId={state.experimentId}
      ideaId={state.ideaId}
      audienceId={state.audience.id}
      initialName={state.audience.name}
      initialSize={state.audience.size}
      initialDefinition={state.audience.definition}
      initialStatus={state.audience.status}
      mockMode={env().MOCK_LLM}
      templates={templates.map((t) => ({ id: t.id, name: t.name, size: t.size }))}
      initialJob={initialJob}
      initialRows={page.rows}
      initialTotal={page.total}
      initialCharts={charts}
    />
  );
}

export function AudienceSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading audience">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-6 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
