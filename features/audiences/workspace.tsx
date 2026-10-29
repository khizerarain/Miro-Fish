"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardProgress } from "@/features/ideas/wizard/wizard-progress";
import {
  applyTemplate,
  cancelPersonaJob,
  fetchPersonaPage,
  pollPersonaJob,
  saveAudienceDraft,
  startPersonaGeneration,
} from "./actions";
import { FiltersPanel } from "./builder/filters-panel";
import { LiveSummary } from "./builder/live-summary";
import { SegmentCards } from "./builder/segment-cards";
import { SizePicker } from "./builder/size-picker";
import { AUDIENCE_SIZES } from "./constants";
import { estimatePersonaJob, formatCost, formatDuration } from "./cost";
import type { PersonaJobSnapshot } from "./job-types";
import { PopulationView } from "./progress/population-view";
import { AudiencePreview } from "./preview/audience-preview";
import { audienceDefinitionSchema, enabledSegments, type AudienceDefinition } from "./schemas";

type Template = { id: string; name: string; size: number };

type Row = {
  id: string;
  ordinal: number;
  name: string;
  age: number;
  profession: string | null;
  location: string | null;
  segmentKey: string;
  incomeBand: string | null;
  profile: unknown;
};

export function AudienceWorkspace({
  experimentId,
  ideaId,
  audienceId,
  initialName,
  initialSize,
  initialDefinition,
  initialStatus,
  mockMode,
  templates,
  initialJob,
  initialRows,
  initialTotal,
  initialCharts,
}: {
  experimentId: string;
  ideaId: string | null;
  audienceId: string;
  initialName: string;
  initialSize: number;
  initialDefinition: AudienceDefinition;
  initialStatus: "draft" | "generating" | "ready" | "failed";
  mockMode: boolean;
  templates: Template[];
  initialJob: PersonaJobSnapshot | null;
  initialRows: Row[];
  initialTotal: number;
  initialCharts: { total: number; bySegment: Record<string, number>; byIncome: Record<string, number>; byAge: { bucket: string; n: number }[] };
}) {
  const [name, setName] = useState(initialName);
  const [size, setSize] = useState(initialSize);
  const [definition, setDefinition] = useState(initialDefinition);
  const [status, setStatus] = useState(initialStatus);
  const [job, setJob] = useState(initialJob);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [charts, setCharts] = useState(initialCharts);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const estimates = useMemo(
    () => Object.fromEntries(AUDIENCE_SIZES.map((n) => [n, estimatePersonaJob(n, mockMode)])),
    [mockMode],
  );
  const estimate = estimates[size]!;
  const parsed = audienceDefinitionSchema.safeParse(definition);
  const ready = parsed.success && enabledSegments(definition).length > 0;

  const persist = useCallback(
    (patch: { name?: string; size?: number; definition?: AudienceDefinition }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveAudienceDraft(audienceId, patch);
      }, 600);
    },
    [audienceId],
  );

  function updateDef(next: AudienceDefinition) {
    setDefinition(next);
    persist({ definition: next });
  }

  const jobId = job?.jobId;
  useEffect(() => {
    if (status !== "generating" || !jobId) return;
    let alive = true;
    const tick = async () => {
      const res = await pollPersonaJob(jobId);
      if (!alive || !res.ok) return;
      setJob(res.snapshot);
      const finished =
        res.snapshot.status === "complete" ||
        (res.snapshot.total > 0 &&
          res.snapshot.completed >= res.snapshot.total &&
          res.snapshot.status !== "failed" &&
          res.snapshot.status !== "cancelled");
      if (finished) {
        try {
          const page = await fetchPersonaPage(audienceId, { limit: 48 });
          if (page.ok) {
            setRows(page.page.rows);
            setTotal(page.page.total);
            setCharts(page.charts);
          }
        } finally {
          setStatus("ready");
        }
      } else if (res.snapshot.status === "failed") setStatus("failed");
      else if (res.snapshot.status === "cancelled") setStatus("draft");
    };
    const id = setInterval(() => void tick(), 450);
    void tick();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status, jobId, audienceId]);

  async function generate() {
    if (!ready) return;
    setBusy(true);
    await saveAudienceDraft(audienceId, { name, size, definition });
    const res = await startPersonaGeneration(audienceId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setStatus("generating");
    setJob({
      jobId: res.jobId,
      audienceId,
      status: "queued",
      total: size,
      completed: 0,
      failed: 0,
      error: null,
      segmentCounts: {},
      samples: [],
    });
  }

  if (status === "generating" && job) {
    return (
      <div className="space-y-8">
        <WizardProgress current={3} />
        <PopulationView
          snapshot={job}
          segments={definition.segments}
          onCancel={async () => {
            await cancelPersonaJob(job.jobId);
            toast("Stopping after this batch");
          }}
        />
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="space-y-8">
        <WizardProgress current={3} />
        <AudiencePreview
          experimentId={experimentId}
          audienceId={audienceId}
          audienceName={name}
          definition={definition}
          initialRows={rows}
          initialTotal={total}
          initialCharts={charts}
          mockMode={mockMode}
          onRegenerate={() => {
            setStatus("draft");
            setJob(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-36">
      <header className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-eyebrow-caps">New experiment</p>
            <h1 className="font-display text-title">Define your audience</h1>
          </div>
          {mockMode && (
            <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
              Mock AI
            </Badge>
          )}
        </div>
        <WizardProgress current={3} />
      </header>

      {status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>Generation didn&apos;t finish</AlertTitle>
          <AlertDescription>{job?.error ?? "Try again. People already generated were cleared."}</AlertDescription>
        </Alert>
      )}

      <div className="max-w-md space-y-2">
        <Label htmlFor="aud-name">Audience name</Label>
        <Input
          id="aud-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            persist({ name: e.target.value });
          }}
        />
      </div>

      {templates.length > 0 && (
        <div className="max-w-md space-y-2">
          <Label>Start from a template</Label>
          <Select
            onValueChange={(id) => {
              void applyTemplate(audienceId, id).then((res) => {
                if (!res.ok) return toast.error(res.error);
                setDefinition(res.definition);
                setSize(res.size);
                toast("Template applied");
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a saved audience" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} · {t.size.toLocaleString("en-US")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <SegmentCards segments={definition.segments} onChange={(segments) => updateDef({ ...definition, segments })} />
      <FiltersPanel value={definition.filters} onChange={(filters) => updateDef({ ...definition, filters })} />
      <SizePicker
        size={size}
        estimates={estimates}
        onChange={(n) => {
          setSize(n);
          persist({ size: n });
        }}
      />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t bg-background/90 px-4 py-4 pb-6 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-10 lg:px-10 sm:pr-24 lg:pr-28">
        <LiveSummary definition={definition} size={size} />
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href={ideaId ? `/experiments/new?draft=${ideaId}` : "/experiments"}>
              <ArrowLeft /> Edit idea
            </Link>
          </Button>
          <Button size="lg" onClick={generate} disabled={!ready || busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Generate {size.toLocaleString("en-US")} personas
            <ArrowRight />
          </Button>
        </div>
      </div>
      <p className="sr-only">
        {formatCost(estimate.estimatedCostCents, estimate.mock)}, {formatDuration(estimate.estimatedSeconds, estimate.estimatedMinutes)}
      </p>
    </div>
  );
}
