import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { loadCompare } from "./actions";
import { CompareView } from "./compare-view";

export async function CompareLoader({ experimentId }: { experimentId: string }) {
  const res = await loadCompare(experimentId);
  if (!res.ok) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="We couldn't open this comparison"
        description={res.error}
        action={
          <Button asChild>
            <Link href="/experiments">Back to experiments</Link>
          </Button>
        }
      />
    );
  }
  return (
    <CompareView
      experimentId={res.experimentId}
      experimentName={res.experimentName}
      seed={res.seed}
      numbers={res.numbers}
      narrative={res.narrative}
    />
  );
}
