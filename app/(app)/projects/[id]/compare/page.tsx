import type { Metadata } from "next";
import { Suspense } from "react";
import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadRunCompare } from "@/features/history/actions";
import { RunCompareView } from "@/features/history/compare-view";

export const metadata: Metadata = { title: "Compare runs" };

export default function CompareRunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <FromParams params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function FromParams({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  if (!q.a || !q.b) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Pick two runs"
        description="Open the project timeline and choose two completed experiments."
        action={
          <Button asChild>
            <Link href={`/projects/${id}`}>Back to project</Link>
          </Button>
        }
      />
    );
  }
  const res = await loadRunCompare(q.a, q.b);
  if (!res.ok) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Could not compare"
        description={res.error}
        action={
          <Button asChild>
            <Link href={`/projects/${id}`}>Back to project</Link>
          </Button>
        }
      />
    );
  }
  return <RunCompareView a={res.a} b={res.b} numbers={res.numbers} />;
}
