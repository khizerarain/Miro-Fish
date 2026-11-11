import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { experiments, ideas } from "@/db/schema";
import { analysisSchema } from "@/features/ideas/schemas";
import { computeDashboard } from "@/features/results/compute";
import { loadCompactReactions, loadSegmentLabels } from "@/features/results/queries";
import { parseVariantContent } from "@/features/simulations/queries";
import { experimentVariants } from "@/db/schema";
import { computeComparison, packVariant } from "@/features/variants/compare-compute";
import type { RunSnapshot } from "./types";

export type { RunSnapshot } from "./types";

export async function snapshotRun(experimentId: string): Promise<RunSnapshot | null> {
  const db = await getDb();
  const [exp] = await db.select().from(experiments).where(eq(experiments.id, experimentId)).limit(1);
  if (!exp) return null;
  const [idea] = exp.ideaId ? await db.select().from(ideas).where(eq(ideas.id, exp.ideaId)).limit(1) : [undefined];
  const [control] = await db
    .select()
    .from(experimentVariants)
    .where(and(eq(experimentVariants.experimentId, exp.id), eq(experimentVariants.isControl, true)))
    .limit(1);
  const product = parseVariantContent(control?.content);
  const analysis = analysisSchema.safeParse(idea?.analysis);
  const rows = await loadCompactReactions(exp.id);
  const labels = await loadSegmentLabels(exp.audienceId);
  const stats = computeDashboard(rows, labels);
  return {
    id: exp.id,
    name: exp.name,
    status: exp.status,
    seed: exp.seed,
    changeSummary: exp.changeSummary,
    parentExperimentId: exp.parentExperimentId,
    createdAt: exp.createdAt.toISOString(),
    completedAt: exp.completedAt?.toISOString() ?? null,
    meanInterest: stats.meanInterest,
    n: stats.n,
    topObjections: stats.objections.slice(0, 5).map((o) => ({ text: o.text, pct: o.pct })),
    idea: {
      description: idea?.description ?? "",
      valueProposition: analysis.success ? analysis.data.valueProposition : product.valueProposition,
      adHeadline: idea?.adHeadline ?? product.adHeadline,
      listedPrice: product.listedPrice,
    },
  };
}

export async function compareRuns(aId: string, bId: string, segmentLabels: Record<string, string>) {
  const [aExp, bExp] = await Promise.all([snapshotRun(aId), snapshotRun(bId)]);
  if (!aExp || !bExp) return null;
  const [aRows, bRows] = await Promise.all([loadCompactReactions(aId), loadCompactReactions(bId)]);
  const packs = [
    packVariant(aId, aExp.name, true, aRows, segmentLabels),
    packVariant(bId, bExp.name, false, bRows, segmentLabels),
  ];
  return { a: aExp, b: bExp, numbers: computeComparison(packs) };
}
