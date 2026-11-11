import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadDashboard } from "./actions";
import { ResultsWorkspace } from "./workspace";

export async function ResultsLoader({ experimentId }: { experimentId: string }) {
  const res = await loadDashboard(experimentId);
  if (!res.ok) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="We couldn't open this dashboard"
        description={res.error}
        action={
          <Button asChild>
            <Link href="/experiments">Back to experiments</Link>
          </Button>
        }
      />
    );
  }
  return <ResultsWorkspace initial={res.data} />;
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-6 w-full max-w-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
