"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clusterThemes } from "./cluster";
import { applyFilters, computeDashboard } from "./compute";
import { FilterBar } from "./filter-bar";
import { pollAnalysis, retryAnalysis, startAnalysis } from "./actions";
import type { DashboardPayload } from "./actions";
import { emptyFilters, type DashboardFilters } from "./schemas";
import { ExportBar } from "./sections/export-bar";
import { FeatureRequests } from "./sections/features";
import { Hero } from "./sections/hero";
import { Messaging } from "./sections/messaging";
import { Objections } from "./sections/objections";
import { Pricing } from "./sections/pricing";
import { Recommendations } from "./sections/recommendations";
import { Segments } from "./sections/segments";
import { Sentiment } from "./sections/sentiment";
import { Validate } from "./sections/validate";
import { ResultsEmpty } from "./empty";
import { ChatDrawer, type ChatTarget } from "@/features/chat/drawer";
import { PeopleStrip } from "@/features/chat/people";
import { RealityPanel } from "@/features/reality/panel";

const EXPLAINER_KEY = "mf-dash-explainer-v1";
const EXPLAINER_EVENT = "mf-dash-explainer";
const explainerStore = {
  subscribe: (cb: () => void) => {
    window.addEventListener(EXPLAINER_EVENT, cb);
    return () => window.removeEventListener(EXPLAINER_EVENT, cb);
  },
  get: () => !window.localStorage.getItem(EXPLAINER_KEY),
};

export function ResultsWorkspace({
  initial,
  shareMode = false,
}: {
  initial: DashboardPayload;
  shareMode?: boolean;
}) {
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters());
  const [narrative, setNarrative] = useState(initial.narrative);
  const [analysis, setAnalysis] = useState(initial.analysis);
  const [chat, setChat] = useState<ChatTarget | null>(null);
  const showExplainer = useSyncExternalStore(explainerStore.subscribe, explainerStore.get, () => false);

  const filtered = useMemo(() => applyFilters(initial.rows, filters), [initial.rows, filters]);
  const stats = useMemo(() => computeDashboard(filtered, initial.segmentLabels), [filtered, initial.segmentLabels]);
  const objectionClusters = useMemo(
    () =>
      clusterThemes(
        filtered,
        narrative?.objectionThemes ?? [],
        (r) => r.objections,
        (r) => r.firstImpression,
      ),
    [filtered, narrative],
  );
  const featureClusters = useMemo(
    () =>
      clusterThemes(
        filtered,
        narrative?.featureThemes ?? [],
        (r) => [...r.wantedFeatures, ...r.missingFeatures],
        (r) => r.whatWouldConvinceThem,
      ),
    [filtered, narrative],
  );

  const live = analysis && (analysis.status === "queued" || analysis.status === "analyzing");
  const jobId = analysis?.jobId;

  useEffect(() => {
    if (shareMode || narrative || !initial.rows.length) return;
    if (analysis && (analysis.status === "queued" || analysis.status === "analyzing" || analysis.status === "failed")) return;
    let gone = false;
    void startAnalysis(initial.experimentId).then(async (res) => {
      if (gone || !res.ok) return;
      const snap = await pollAnalysis(res.jobId);
      if (gone || !snap.ok) {
        setAnalysis({ jobId: res.jobId, status: "queued", error: null });
        return;
      }
      setAnalysis(snap.snapshot);
      if (snap.narrative) setNarrative(snap.narrative);
    });
    return () => {
      gone = true;
    };
  }, [shareMode, narrative, analysis, initial.rows.length, initial.experimentId]);

  useEffect(() => {
    if (!live || !jobId) return;
    let alive = true;
    const tick = async () => {
      const res = await pollAnalysis(jobId);
      if (!alive || !res.ok) return;
      setAnalysis(res.snapshot);
      if (res.narrative) setNarrative(res.narrative);
    };
    const id = setInterval(() => void tick(), 700);
    const kick = setTimeout(() => void tick(), 120);
    return () => {
      alive = false;
      clearInterval(id);
      clearTimeout(kick);
    };
  }, [live, jobId]);

  const filterActive = filters.segment !== "all" || filters.age !== "all" || filters.income !== "all" || filters.intent !== "all";
  const segments = Object.entries(initial.segmentLabels).map(([key, label]) => ({ key, label }));
  const partial = initial.runStatus === "cancelled" || initial.runStatus === "failed";

  if (!initial.rows.length) {
    return <ResultsEmpty simulateHref={initial.simulateHref} runStatus={initial.runStatus} />;
  }

  return (
    <div className="space-y-8 print:space-y-6">
      {showExplainer && (
        <Alert>
          <AlertTitle>Simulated hypotheses, not verified demand</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Every number here is counted from stored reactions. Notes around them are still hypotheses.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.localStorage.setItem(EXPLAINER_KEY, "1");
                window.dispatchEvent(new Event(EXPLAINER_EVENT));
              }}
            >
              Got it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {partial && (
        <Alert>
          <AlertTitle>Partial run</AlertTitle>
          <AlertDescription>
            This simulation did not finish. The dashboard uses the {initial.rows.length} reactions that were stored.
            {!shareMode && (
              <>
                {" "}
                <Link className="underline" href={initial.simulateHref}>
                  Resume or rerun
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {analysis?.status === "failed" && !shareMode && (
        <Alert variant="destructive">
          <AlertTitle>Notes didn&apos;t generate</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{analysis.error ?? "You can still read the numbers. Retry the notes when you want."}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await retryAnalysis(initial.experimentId);
                if (res.ok) setAnalysis({ jobId: res.jobId, status: "queued", error: null });
              }}
            >
              Retry notes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          segments={segments}
          disabled={false}
        />
        <ExportBar
          rows={filtered}
          labels={initial.segmentLabels}
          sharePath={initial.sharePath}
          name={initial.experimentName}
          shareMode={shareMode}
        />
      </div>
      {!shareMode && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" asChild>
            <Link href={initial.variantsHref}>A/B test</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={initial.compareHref}>Compare variants</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={initial.notesHref}>Research notes</Link>
          </Button>
          {initial.historyHref && (
            <Button variant="outline" asChild>
              <Link href={initial.historyHref}>Project history</Link>
            </Button>
          )}
        </div>
      )}

      {!narrative && live && <NotesSkeleton />}

      <Hero stats={stats} narrative={narrative} name={initial.experimentName} filtered={filterActive} />
      <Segments
        stats={stats}
        labels={initial.segmentLabels}
        onSelect={(segment) => setFilters((f) => ({ ...f, segment: f.segment === segment ? "all" : segment }))}
      />
      <Sentiment stats={stats} />
      <Objections clusters={objectionClusters} labels={initial.segmentLabels} />
      <FeatureRequests clusters={featureClusters} />
      <Pricing stats={stats} narrative={narrative} labels={initial.segmentLabels} />
      {!shareMode && (
        <PeopleStrip
          rows={filtered}
          labels={initial.segmentLabels}
          onTalk={(r) => setChat({ personaId: r.personaId, variantId: r.variantId })}
        />
      )}
      <Messaging
        stats={stats}
        narrative={narrative}
        experimentId={initial.experimentId}
        shareMode={shareMode}
        onTalk={(personaId, variantId) => setChat({ personaId, variantId })}
      />
      <Recommendations narrative={narrative} experimentId={initial.experimentId} shareMode={shareMode} />
      {!shareMode && <RealityPanel experimentId={initial.experimentId} initial={initial.reality} />}
      <Validate narrative={narrative} />

      {!shareMode && (
        <p className="text-xs text-muted-foreground">
          <Link href={initial.simulateHref} className="underline">
            Simulation
          </Link>
          {" · "}
          <Link href={initial.audienceHref} className="underline">
            Audience
          </Link>
          {" · "}
          <Link href={initial.variantsHref} className="underline">
            A/B variants
          </Link>
        </p>
      )}
      {!shareMode && <ChatDrawer experimentId={initial.experimentId} target={chat} onClose={() => setChat(null)} />}
    </div>
  );
}

function NotesSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Writing notes around the numbers">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
