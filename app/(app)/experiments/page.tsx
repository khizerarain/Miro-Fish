import { FlaskConical, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ExperimentList, ExperimentListSkeleton } from "@/features/experiments/experiment-list";
import { listExperiments } from "@/features/experiments/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Experiments" };

const newButton = (
  <Button asChild>
    <Link href="/experiments/new">
      <Plus /> New experiment
    </Link>
  </Button>
);

async function Experiments() {
  const user = await requireUser();
  const { items, now } = await listExperiments(user.id);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="Nothing tested yet"
        description="Experiments you run will appear here, so you can compare runs and track how results move over time."
        action={newButton}
      />
    );
  }
  return <ExperimentList items={items} now={now} />;
}

export default function ExperimentsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Experiments"
        title="Experiments"
        description="Every idea you test, with its audience, simulated reactions, and findings."
        actions={newButton}
      />
      <Suspense fallback={<ExperimentListSkeleton />}>
        <Experiments />
      </Suspense>
    </div>
  );
}
