import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { loadVariants } from "./actions";
import { VariantsWorkspace } from "./workspace";

export async function VariantsLoader({ experimentId }: { experimentId: string }) {
  const res = await loadVariants(experimentId);
  if (!res.ok) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="We couldn't open variants"
        description={res.error}
        action={
          <Button asChild>
            <Link href="/experiments">Back to experiments</Link>
          </Button>
        }
      />
    );
  }
  return <VariantsWorkspace experimentId={experimentId} seed={res.seed} initial={res.variants} />;
}
