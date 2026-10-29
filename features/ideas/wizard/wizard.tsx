"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyzeIdea, confirmIdea, reopenIdea, saveAnalysis } from "../actions";
import { type Analysis, analysisSchema, type IdeaInput, type IdeaStatus, inputReadiness, LIMITS } from "../schemas";
import { AdTab } from "./ad-tab";
import { AnalysisCard } from "./analysis-card";
import { AnalysisSkeleton } from "./analysis-skeleton";
import { DescribeTab } from "./describe-tab";
import { clearLocalDraft, readLocalDraft } from "./local-draft";
import { PricingTab } from "./pricing-tab";
import { SaveIndicator } from "./save-indicator";
import { UrlTab } from "./url-tab";
import { useAutosave } from "./use-autosave";
import { WizardProgress } from "./wizard-progress";

export type WizardInitial = {
  ideaId: string | null;
  input: IdeaInput;
  status: IdeaStatus;
  analysis: Analysis | null;
  analysisStale: boolean;
  updatedAt: number | null;
};

type Step = 1 | 2 | 3;
const stepFor = (status: IdeaStatus): Step => (status === "confirmed" ? 3 : status === "draft" ? 1 : 2);

const TABS = [
  { value: "describe", label: "Describe it", source: "description" },
  { value: "url", label: "Website", source: "url" },
  { value: "pricing", label: "Pricing", source: "pricing" },
  { value: "ad", label: "Ad copy", source: "ad" },
] as const;

export function Wizard({ initial, mockMode }: { initial: WizardInitial; mockMode: boolean }) {
  const [input, setInput] = useState(initial.input);
  const [step, setStep] = useState<Step>(stepFor(initial.status));
  const [analysis, setAnalysis] = useState(initial.analysis);
  const [stale, setStale] = useState(initial.analysisStale);
  const [analyzing, setAnalyzing] = useState(initial.status === "analyzing");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("describe");
  const [analysisSave, setAnalysisSave] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const router = useRouter();

  const autosave = useAutosave(initial.ideaId);
  const { sources, ready } = inputReadiness(input);

  const update = (patch: Partial<IdeaInput>) => {
    const next = { ...input, ...patch };
    setInput(next);
    autosave.change(next);
    if (analysis) setStale(true);
  };

  // After hydration, prefer a newer local copy (typing that hadn't reached the server before a refresh).
  const restored = useRef(false);
  const { change } = autosave;
  useEffect(() => {
    if (restored.current || initial.status !== "draft") return;
    restored.current = true;
    const local = readLocalDraft(initial.ideaId);
    if (!local || (initial.updatedAt && local.savedAt <= initial.updatedAt)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage after hydration
    setInput(local.input);
    change(local.input);
    toast("Restored your unsaved changes");
  }, [initial, change]);

  const runAnalysis = useCallback(async (ideaId: string, force = false) => {
    setAnalyzing(true);
    setAnalysisError(null);
    const res = await analyzeIdea(ideaId, { force }).catch(() => ({
      ok: false as const,
      error: "Network error. Try again.",
    }));
    setAnalyzing(false);
    if (res.ok) {
      setAnalysis(res.state.analysis);
      setStale(false);
      setAnalysisSave("idle");
    } else {
      setAnalysisError(res.error);
    }
  }, []);

  // Refreshed mid-analysis: pick it back up.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || initial.status !== "analyzing" || !initial.ideaId) return;
    resumed.current = true;
    void runAnalysis(initial.ideaId);
  }, [initial, runAnalysis]);

  // Debounced save of analysis edits.
  const analysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editAnalysis = (next: Analysis) => {
    setAnalysis(next);
    setAnalysisSave("pending");
    if (analysisTimer.current) clearTimeout(analysisTimer.current);
    analysisTimer.current = setTimeout(async () => {
      const parsed = analysisSchema.safeParse(next);
      if (!parsed.success || !autosave.ideaId) return;
      const res = await saveAnalysis(autosave.ideaId, parsed.data).catch(() => null);
      setAnalysisSave(res?.ok ? "saved" : "error");
    }, 800);
  };
  const analysisValid = analysis ? analysisSchema.safeParse(analysis).success : false;

  async function goAnalyze() {
    if (!ready) return;
    setBusy(true);
    const id = await autosave.flush(input);
    setBusy(false);
    if (!id) {
      toast.error("We couldn't save your draft. Check your connection and try again.");
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Returns the stored analysis instantly when the inputs haven't changed.
    await runAnalysis(id);
  }

  async function backToEdit() {
    if (!autosave.ideaId) return setStep(1);
    setBusy(true);
    const res = await reopenIdea(autosave.ideaId).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error("Couldn't reopen the idea. Try again.");
    setStep(1);
  }

  async function confirm() {
    if (!analysis || !autosave.ideaId) return;
    if (analysisTimer.current) clearTimeout(analysisTimer.current);
    setBusy(true);
    const res = await confirmIdea(autosave.ideaId, analysis).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error(res?.error ?? "Couldn't confirm. Try again.");
    clearLocalDraft(autosave.ideaId);
    setExperimentId(res.experimentId);
    router.push(`/experiments/${res.experimentId}/audience`);
  }

  const heading = { 1: "Submit your idea", 2: "Review the analysis", 3: "Idea confirmed" }[step];

  return (
    <div className="space-y-8 pb-24">
      <header className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-eyebrow-caps">New experiment</p>
            <h1 className="font-display text-title">{heading}</h1>
          </div>
          <div className="flex items-center gap-3">
            {step === 1 && <SaveIndicator state={autosave.state} />}
            {step === 2 && analysisSave !== "idle" && (
              <p className="text-xs text-muted-foreground" role="status">
                {analysisSave === "pending"
                  ? analysisValid
                    ? "Saving edits…"
                    : "Fill in the highlighted fields"
                  : analysisSave === "saved"
                    ? "Edits saved"
                    : "Couldn't save edits"}
              </p>
            )}
            {mockMode && (
              <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
                Mock AI
              </Badge>
            )}
          </div>
        </div>
        <WizardProgress current={step} />
      </header>

      {step === 1 && (
        <section aria-label="Your idea" className="space-y-8">
          <div className="max-w-md space-y-2">
            <Label htmlFor="idea-title">Name (optional)</Label>
            <Input
              id="idea-title"
              value={input.title}
              maxLength={LIMITS.title}
              placeholder="e.g. Ledgerly"
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Use any combination. More context means a sharper analysis and more realistic reactions.
            </p>
            <Tabs value={tab} onValueChange={setTab} className="gap-6">
              <TabsList className="h-auto flex-wrap">
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="gap-2">
                    {t.label}
                    {sources[t.source] && (
                      <>
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                        <span className="sr-only">(added)</span>
                      </>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="describe">
                <DescribeTab
                  value={input.description}
                  onChange={(description) => update({ description })}
                  onExample={(ex) => update({ title: input.title || ex.title, description: ex.description })}
                />
              </TabsContent>
              <TabsContent value="url">
                <UrlTab url={input.url} extract={input.urlExtract} onChange={update} />
              </TabsContent>
              <TabsContent value="pricing">
                <PricingTab value={input.pricing} onChange={(pricing) => update({ pricing })} />
              </TabsContent>
              <TabsContent value="ad">
                <AdTab value={input} onChange={update} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t bg-background/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-10 lg:px-10">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {ready
                ? stale && analysis
                  ? "You changed your inputs, so we'll analyze again."
                  : "Ready when you are."
                : "Add a description, website text, or ad copy to continue."}
            </p>
            <Button size="lg" onClick={goAnalyze} disabled={!ready || busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {analysis && !stale ? "Continue to analysis" : "Analyze my idea"}
              <ArrowRight />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Analysis" className="space-y-6">
          {stale && analysis && !analyzing && (
            <Alert>
              <RefreshCw />
              <AlertTitle className="line-clamp-none">Your inputs changed since this analysis</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                Re-analyze to reflect them, or keep these results.
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => autosave.ideaId && runAnalysis(autosave.ideaId, true)}
                >
                  Re-analyze
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {analysisError && !analyzing && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Analysis didn&apos;t finish</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{analysisError}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => autosave.ideaId && runAnalysis(autosave.ideaId, true)}>
                    Try again
                  </Button>
                  <Button size="sm" variant="outline" onClick={backToEdit}>
                    Edit inputs
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {analyzing ? (
            <AnalysisSkeleton />
          ) : analysis ? (
            <AnalysisCard value={analysis} onChange={editAnalysis} />
          ) : null}

          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t bg-background/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-10 lg:px-10">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={backToEdit} disabled={busy || analyzing}>
                <ArrowLeft /> Edit inputs
              </Button>
              {analysis && !analyzing && (
                <Button variant="outline" onClick={() => autosave.ideaId && runAnalysis(autosave.ideaId, true)}>
                  <RefreshCw /> Re-analyze
                </Button>
              )}
            </div>
            <Button size="lg" onClick={confirm} disabled={!analysis || !analysisValid || analyzing || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />}
              Confirm and continue
            </Button>
          </div>
        </section>
      )}

      {step === 3 && analysis && (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-soft-foreground">
              <Check className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="font-display text-heading font-normal">
              <h2>{input.title || "Your idea"} is ready for an audience</h2>
            </CardTitle>
            <CardDescription>{analysis.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-eyebrow-caps">Segments we&apos;ll start from</p>
            <ul className="flex flex-wrap gap-2">
              {analysis.targetMarkets.map((m) => (
                <li key={m.segment}>
                  <Badge variant="secondary">{m.segment}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Next: define who these people are.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={backToEdit} disabled={busy}>
                Edit idea
              </Button>
              <Button asChild>
                <Link href={experimentId ? `/experiments/${experimentId}/audience` : "/experiments"}>
                  Define audience <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
