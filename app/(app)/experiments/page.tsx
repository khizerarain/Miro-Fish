import { FlaskConical, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  const cta = (
    <Button asChild>
      <Link href="/experiments/new">
        <Plus /> New experiment
      </Link>
    </Button>
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Experiments"
        title="Experiments"
        description="Every idea you test, with its audience, simulated reactions, and findings."
      />
      <EmptyState
        icon={FlaskConical}
        title="Nothing tested yet"
        description="Experiments you run will appear here, so you can compare runs and track how results move over time."
        action={cta}
      />
    </div>
  );
}
