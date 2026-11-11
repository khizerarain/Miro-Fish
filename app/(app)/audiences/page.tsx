import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { inArray } from "drizzle-orm";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { experiments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listAudiences } from "@/features/audiences/queries";

export const metadata: Metadata = { title: "Audiences" };

async function List() {
  const user = await requireUser();
  const items = await listAudiences(user.id);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No saved audiences"
        description="Audiences are created as part of an experiment. Save one as a template to reuse it across ideas."
        action={
          <Button asChild>
            <Link href="/experiments/new">Start an experiment</Link>
          </Button>
        }
      />
    );
  }

  const db = await getDb();
  const rows = await db
    .select({ id: experiments.id, audienceId: experiments.audienceId })
    .from(experiments)
    .where(
      inArray(
        experiments.audienceId,
        items.map((a) => a.id),
      ),
    );
  const experimentForAudience = new Map(rows.map((r) => [r.audienceId, r.id]));

  const list = items.map((a) => ({
    ...a,
    experimentId: experimentForAudience.get(a.id) ?? null,
  }));

  return (
    <div className="space-y-8">
      {list.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-subheading font-medium">Your audiences</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {list.map((a) => {
              const body = (
                <>
                  <span className="min-w-0 font-medium">
                    {a.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {a.size.toLocaleString("en-US")} people
                    </span>
                  </span>
                  <Badge variant={a.isTemplate ? "secondary" : "outline"}>{a.isTemplate ? "Template" : a.status}</Badge>
                </>
              );
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  {a.experimentId ? (
                    <Link href={`/experiments/${a.experimentId}/audience`} className="flex min-w-0 flex-1 items-center justify-between gap-4 hover:underline">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AudiencesPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Audiences"
        title="Audiences"
        description="Reusable populations of simulated customers. Same audience and seed means runs you can compare."
      />
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-2xl border" aria-busy="true" aria-label="Loading audiences" />
        }
      >
        <List />
      </Suspense>
    </div>
  );
}
