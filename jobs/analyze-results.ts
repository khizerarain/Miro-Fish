import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experimentVariants, experiments, insights, jobs } from "@/db/schema";
import { centsFromTokens } from "@/features/simulations/cost";
import { topPhrasesForLlm } from "@/features/results/cluster";
import { computeDashboard } from "@/features/results/compute";
import { mockAnalyzeResults } from "@/features/results/mock-narrative";
import { loadCompactReactions, loadSegmentLabels } from "@/features/results/queries";
import { analyzeResultsSchema, type AnalyzeResults } from "@/features/results/schemas";
import { generateJson, LlmError } from "@/lib/llm";
import { analyzeResultsV1 } from "@/prompts/analyze-results.v1";

const running = new Set<string>();
const chain = new Map<string, Promise<void>>();

function enqueue(jobId: string, fn: () => Promise<void>) {
  const next = (chain.get(jobId) ?? Promise.resolve()).then(fn, fn);
  chain.set(jobId, next);
  return next;
}

export async function ensureAnalysisJobRunning(jobId: string) {
  return enqueue(jobId, async () => {
    if (running.has(jobId)) return;
    running.add(jobId);
    try {
      await runAnalysis(jobId);
    } finally {
      running.delete(jobId);
    }
  });
}

export async function tickAnalysisJob(jobId: string) {
  return enqueue(jobId, async () => {
    if (running.has(jobId)) return;
    await runAnalysis(jobId);
  });
}

export type AnalysisSnapshot = {
  jobId: string;
  status: "queued" | "analyzing" | "complete" | "failed";
  error: string | null;
};

export async function snapshotAnalysisJob(jobId: string): Promise<AnalysisSnapshot | null> {
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return null;
  const status =
    job.status === "queued"
      ? "queued"
      : job.status === "complete" || job.status === "failed"
        ? job.status
        : "analyzing";
  return { jobId: job.id, status, error: job.error };
}

async function runAnalysis(jobId: string) {
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job?.experimentId) return;
  if (job.status === "complete" || job.status === "failed") return;
  if (job.cancelRequestedAt) {
    await db.update(jobs).set({ status: "cancelled", finishedAt: new Date() }).where(eq(jobs.id, jobId));
    return;
  }

  await db.update(jobs).set({ status: "analyzing", startedAt: job.startedAt ?? new Date() }).where(eq(jobs.id, jobId));
  await db.update(experiments).set({ status: "analyzing" }).where(eq(experiments.id, job.experimentId));

  try {
    const rows = await loadCompactReactions(job.experimentId);
    if (!rows.length) throw new Error("No stored reactions to analyze.");
    const labels = await loadSegmentLabels(job.audienceId);
    const stats = computeDashboard(rows, labels);
    const [variant] = job.experimentId
      ? await db
          .select()
          .from(experimentVariants)
          .where(and(eq(experimentVariants.experimentId, job.experimentId), eq(experimentVariants.isControl, true)))
          .limit(1)
      : [];
    const product = variant?.content ?? {};
    const statsForLlm = {
      n: stats.n,
      simulated: stats.simulated,
      extrapolated: stats.extrapolated,
      meanInterest: stats.meanInterest,
      medianInterest: stats.medianInterest,
      byIntent: stats.byIntent,
      intentPct: stats.intentPct,
      byPrice: stats.byPrice,
      pricePct: stats.pricePct,
      recommendPct: stats.recommendPct,
      interested: stats.interested,
      ignoring: stats.ignoring,
      hostile: stats.hostile,
      bySegment: stats.bySegment,
      wtpMean: stats.wtp.mean,
      topObjections: stats.objections.slice(0, 8),
      topWanted: stats.wanted.slice(0, 8),
    };

    const out = await generateJson({
      prompt: analyzeResultsV1,
      vars: {
        statsJson: JSON.stringify(statsForLlm),
        productJson: JSON.stringify(product),
        objectionPhrasesJson: JSON.stringify(topPhrasesForLlm(stats.objections)),
        featurePhrasesJson: JSON.stringify(topPhrasesForLlm([...stats.wanted, ...stats.missing])),
        jsonSchema: JSON.stringify(z.toJSONSchema(analyzeResultsSchema)),
      },
      schema: analyzeResultsSchema,
      mock: () => mockAnalyzeResults(stats, typeof (product as { summary?: string }).summary === "string" ? (product as { summary: string }).summary : ""),
      mockDelayMs: 420,
    });

    const narrative: AnalyzeResults = out.data;
    await db
      .delete(insights)
      .where(
        and(
          eq(insights.experimentId, job.experimentId),
          inArray(insights.kind, [
            "headline",
            "objection_cluster",
            "feature_cluster",
            "pricing",
            "messaging",
            "recommendation",
            "validation",
          ]),
        ),
      );
    await db.insert(insights).values([
      { experimentId: job.experimentId, kind: "headline", payload: narrative, promptVersion: "analyze-results@v1" },
      { experimentId: job.experimentId, kind: "objection_cluster", payload: { themes: narrative.objectionThemes }, promptVersion: "analyze-results@v1" },
      { experimentId: job.experimentId, kind: "feature_cluster", payload: { themes: narrative.featureThemes }, promptVersion: "analyze-results@v1" },
      { experimentId: job.experimentId, kind: "pricing", payload: { takeaway: narrative.pricingTakeaway }, promptVersion: "analyze-results@v1" },
      { experimentId: job.experimentId, kind: "messaging", payload: narrative.messaging, promptVersion: "analyze-results@v1" },
      { experimentId: job.experimentId, kind: "recommendation", payload: { items: narrative.recommendations }, promptVersion: "analyze-results@v1" },
      { experimentId: job.experimentId, kind: "validation", payload: narrative.validation, promptVersion: "analyze-results@v1" },
    ]);

    const cost = centsFromTokens(out.usage.inputTokens, out.usage.outputTokens);
    const [exp] = await db.select({ actual: experiments.actualCostCents }).from(experiments).where(eq(experiments.id, job.experimentId)).limit(1);
    await db
      .update(jobs)
      .set({
        status: "complete",
        completedUnits: 1,
        totalUnits: 1,
        finishedAt: new Date(),
        inputTokens: out.usage.inputTokens,
        outputTokens: out.usage.outputTokens,
      })
      .where(eq(jobs.id, jobId));
    await db
      .update(experiments)
      .set({ status: "complete", actualCostCents: (exp?.actual ?? 0) + cost })
      .where(eq(experiments.id, job.experimentId));
  } catch (err) {
    const message = err instanceof LlmError ? err.message : (err as Error).message;
    await db.update(jobs).set({ status: "failed", error: message.slice(0, 1000), finishedAt: new Date() }).where(eq(jobs.id, jobId));
    await db.update(experiments).set({ status: "complete" }).where(eq(experiments.id, job.experimentId));
  }
}
