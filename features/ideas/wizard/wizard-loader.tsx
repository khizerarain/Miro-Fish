import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getOwnedIdea, rowToWizardState } from "../queries";
import { emptyIdeaInput } from "../schemas";
import { Wizard, type WizardInitial } from "./wizard";

export async function WizardLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { draft } = await searchParams;
  const draftId = typeof draft === "string" ? draft : null;
  const mockMode = env().MOCK_LLM;

  if (!draftId) {
    const initial: WizardInitial = {
      ideaId: null,
      input: emptyIdeaInput(),
      status: "draft",
      analysis: null,
      analysisStale: false,
      updatedAt: null,
    };
    return <Wizard key="new" initial={initial} mockMode={mockMode} />;
  }

  const idea = await getOwnedIdea(user.id, draftId);
  if (!idea) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="We couldn't find that draft"
        description="It may have been discarded, or it belongs to another account."
        action={
          <Button asChild>
            <Link href="/experiments/new">Start a new experiment</Link>
          </Button>
        }
      />
    );
  }

  return <Wizard key={idea.id} initial={rowToWizardState(idea)} mockMode={mockMode} />;
}

export function WizardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading experiment">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-6 w-full max-w-xl" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-9 w-96 max-w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
