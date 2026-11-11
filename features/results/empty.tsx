import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export function ResultsEmpty({ simulateHref, runStatus }: { simulateHref: string; runStatus: string }) {
  const failed = runStatus === "failed";
  return (
    <EmptyState
      icon={FileQuestion}
      title={failed ? "This run failed before reactions landed" : "No reactions stored yet"}
      description={
        failed
          ? "The simulation did not finish. Rerun it, then this dashboard will count whatever is stored."
          : "Run the simulation first. Every chart here is built from stored reactions."
      }
      action={
        <Button asChild>
          <Link href={simulateHref}>Go to simulation</Link>
        </Button>
      }
    />
  );
}
