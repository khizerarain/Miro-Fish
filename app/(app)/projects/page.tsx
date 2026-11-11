import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ProjectList } from "@/features/projects/project-list";
import { listProjects } from "@/features/projects/queries";
import { requireUser } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Projects" };

async function Board() {
  const user = await requireUser();
  const items = await listProjects(user.id);
  return <ProjectList items={items} />;
}

export default function ProjectsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Group runs of the same idea so you can compare how simulated results move over time."
      />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <Board />
      </Suspense>
    </div>
  );
}
