import { ArrowRight, FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExperimentList, ExperimentListSkeleton } from "@/features/experiments/experiment-list";
import { listExperiments } from "@/features/experiments/queries";
import { listProjects } from "@/features/projects/queries";
import { requireUser } from "@/lib/auth";
import { OnboardingTour } from "@/components/onboarding-tour";

function greeting(name: string | null) {
  const first = name?.split(" ")[0];
  return first ? `Welcome, ${first}` : "Welcome";
}

export async function DashboardContent() {
  const user = await requireUser();
  const [{ items, now }, projects] = await Promise.all([listExperiments(user.id, 6), listProjects(user.id)]);

  return (
    <div className="space-y-10">
      <OnboardingTour />
      <PageHeader
        eyebrow="Dashboard"
        title={greeting(user.name)}
        description="Your research lab. Submit an idea, define an audience, and see how simulated customers react."
        actions={
          items.length > 0 && (
            <Button asChild>
              <Link href="/experiments/new">
                <Plus /> New experiment
              </Link>
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Describe a product, paste a landing page, or drop in ad copy. We'll build a simulated audience and show you where it lands, and where it doesn't."
          action={
            <Button asChild size="lg">
              <Link href="/experiments/new">
                Start your first experiment <ArrowRight />
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-subheading font-medium">Recent experiments</h2>
            <Link
              href="/experiments"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View all
            </Link>
          </div>
          <ExperimentList items={items} now={now} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
        </section>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <ExperimentListSkeleton />
    </div>
  );
}
