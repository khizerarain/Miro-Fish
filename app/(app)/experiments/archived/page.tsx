import type { Metadata } from "next";
import { Archive } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RestoreButton } from "@/features/experiments/restore-button";
import { listExperiments } from "@/features/experiments/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Archived experiments" };

async function Archived() {
  const user = await requireUser();
  const { items } = await listExperiments(user.id, 100, { archived: true });
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="Nothing archived"
        description="Archived runs stop counting against your active experiment limit and disappear from the main list. They stay here until you restore them."
        action={
          <Button asChild variant="outline">
            <Link href="/experiments">Back to experiments</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">Archived · {item.runStatus}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/experiments/${item.id}/results`}>Open</Link>
            </Button>
            <RestoreButton experimentId={item.id} name={item.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ArchivedExperimentsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Experiments"
        title="Archived"
        description="Runs you archived. Restoring one puts it back in your experiments and counts it again."
        actions={
          <Button variant="outline" asChild>
            <Link href="/experiments">All experiments</Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
        <Archived />
      </Suspense>
    </div>
  );
}
