import type { Metadata } from "next";
import { Suspense } from "react";
import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadRunHistory } from "@/features/history/actions";
import { ProjectTimeline } from "@/features/history/timeline";

export const metadata: Metadata = { title: "Project history" };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadRunHistory(id);
  if (!res.ok) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Project missing"
        description={res.error}
        action={
          <Button asChild>
            <Link href="/projects">Back to projects</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ProjectTimeline
      projectId={res.project.id}
      projectName={res.project.name}
      runs={res.runs}
      series={res.series}
    />
  );
}
