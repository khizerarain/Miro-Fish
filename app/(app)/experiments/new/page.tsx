import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "New experiment" };

export default function NewExperimentPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="New experiment" title="Submit your idea" />
      <EmptyState
        icon={Lightbulb}
        title="The experiment wizard is on its way"
        description="Soon you'll describe your product, paste a URL, or add pricing and ad copy here. It's the next thing we're building."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
