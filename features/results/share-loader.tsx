import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { env } from "@/lib/env";
import { loadCompactReactions, loadNarrative, loadSegmentLabels, getExperimentById } from "./queries";
import { parseShareToken, makeShareToken } from "./share";
import { ResultsWorkspace } from "./workspace";
import type { DashboardPayload } from "./actions";

export async function ShareLoader({ token }: { token: string }) {
  const experimentId = parseShareToken(token);
  if (!experimentId) return <ShareMissing />;
  const exp = await getExperimentById(experimentId);
  if (!exp) return <ShareMissing />;
  const [rows, labels, narrative] = await Promise.all([
    loadCompactReactions(exp.id),
    loadSegmentLabels(exp.audienceId),
    loadNarrative(exp.id),
  ]);
  const data: DashboardPayload = {
    experimentId: exp.id,
    experimentName: exp.name,
    runStatus: exp.status,
    mockMode: env().MOCK_LLM,
    rows,
    segmentLabels: labels,
    narrative,
    analysis: narrative ? { jobId: "", status: "complete", error: null } : null,
    listedPrice: null,
    sharePath: `/s/${makeShareToken(exp.id)}`,
    simulateHref: "/login",
    audienceHref: "/login",
    variantsHref: "/login",
    compareHref: "/login",
    notesHref: "/login",
    historyHref: null,
    reality: null,
  };
  return (
    <div className="min-h-svh">
      <header className="border-b print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <SimulatedBadge />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
        <p className="mb-6 text-sm text-muted-foreground">Read-only shared dashboard. Simulated hypotheses, not market data.</p>
        <ResultsWorkspace initial={data} shareMode />
      </main>
    </div>
  );
}

function ShareMissing() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        icon={FileQuestion}
        title="This share link isn't valid"
        description="The link may be wrong, or the experiment was removed."
        action={
          <Button asChild>
            <Link href="/">Back to Miro Fish</Link>
          </Button>
        }
      />
    </div>
  );
}
