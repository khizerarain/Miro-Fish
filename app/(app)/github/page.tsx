import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGithubPage } from "@/features/github/page-data";
import { GithubWorkspace } from "@/features/github/workspace";

export const metadata: Metadata = { title: "GitHub" };

export default function GithubPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Integrations"
        title="GitHub"
        description="Simulated customer reactions on every pull request, for the audience you connect."
        actions={<SimulatedBadge />}
      />
      <Suspense fallback={<WorkspaceSkeleton />}>
        <FromDb />
      </Suspense>
    </div>
  );
}

async function FromDb() {
  const data = await loadGithubPage();
  return <GithubWorkspace data={data} />;
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading GitHub settings">
      <Skeleton className="h-48 w-full max-w-3xl rounded-xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
