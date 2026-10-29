import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listAudiences } from "@/features/audiences/queries";
import { getDb } from "@/db";
import { experiments } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  const links = await Promise.all(
    items.map(async (a) => {
      const [exp] = await db.select({ id: experiments.id }).from(experiments).where(eq(experiments.audienceId, a.id)).limit(1);
      return { ...a, href: exp ? `/experiments/${exp.id}/audience` : "/audiences" };
    }),
  );
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {links.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <Link href={a.href} className="min-w-0 font-medium hover:underline">
            {a.name}
            <p className="text-xs font-normal text-muted-foreground">{a.size.toLocaleString("en-US")} people</p>
          </Link>
          <Badge variant={a.isTemplate ? "secondary" : "outline"}>
            {a.isTemplate ? "Template" : a.status}
          </Badge>
        </li>
      ))}
    </ul>
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
