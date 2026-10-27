import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Audiences" };

export default function AudiencesPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Audiences"
        title="Audiences"
        description="Reusable populations of simulated customers. Same audience and seed means runs you can compare."
      />
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
    </div>
  );
}
