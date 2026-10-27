import { and, count, eq, isNull } from "drizzle-orm";
import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/db";
import { experiments } from "@/db/schema";
import { requireUser } from "@/lib/auth";

function greeting(name: string | null) {
  const first = name?.split(" ")[0];
  return first ? `Welcome, ${first}` : "Welcome";
}

export async function DashboardContent() {
  const user = await requireUser();
  const db = await getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(experiments)
    .where(and(eq(experiments.ownerId, user.id), isNull(experiments.archivedAt)));

  const newExperiment = (
    <Button asChild size="lg">
      <Link href="/experiments/new">
        Start your first experiment <ArrowRight />
      </Link>
    </Button>
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Dashboard"
        title={greeting(user.name)}
        description="Your research lab. Submit an idea, define an audience, and see how simulated customers react."
      />
      {total === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Describe a product, paste a landing page, or drop in ad copy. We'll build a simulated audience and show you where it lands, and where it doesn't."
          action={newExperiment}
        />
      ) : (
        <p className="text-muted-foreground">{total} experiments</p>
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
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
