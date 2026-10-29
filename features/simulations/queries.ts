import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { experimentVariants, experiments, ideas, jobs, personas, reactions } from "@/db/schema";
import { CONTROL_VARIANT_LABEL } from "./constants";
import { tallyFromRows } from "./tally";
import { variantContentFromIdea } from "./variant-content";
import type { ReactionTally } from "./job-types";
import type { VariantContent } from "./schemas";

export async function getExperimentForUser(userId: string, experimentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(experimentId)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.id, experimentId), eq(experiments.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getActiveSimulationJob(experimentId: string) {
  const db = await getDb();
  const inflight = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.experimentId, experimentId),
        eq(jobs.type, "simulate"),
        inArray(jobs.status, ["queued", "simulating"]),
      ),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  if (inflight[0]) return inflight[0];
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.experimentId, experimentId), eq(jobs.type, "simulate")))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return job ?? null;
}

export async function ensureControlVariant(experimentId: string, idea: typeof ideas.$inferSelect | undefined) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(experimentVariants)
    .where(and(eq(experimentVariants.experimentId, experimentId), eq(experimentVariants.label, CONTROL_VARIANT_LABEL)))
    .limit(1);
  const content = variantContentFromIdea({
    analysis: idea?.analysis ?? null,
    pricing: idea?.pricing ?? null,
    adHeadline: idea?.adHeadline ?? null,
    adCopy: idea?.adCopy ?? null,
  });
  if (existing) {
    await db.update(experimentVariants).set({ content }).where(eq(experimentVariants.id, existing.id));
    return { ...existing, content };
  }
  const [created] = await db
    .insert(experimentVariants)
    .values({
      experimentId,
      label: CONTROL_VARIANT_LABEL,
      isControl: true,
      content,
    })
    .returning();
  return created;
}

export async function listPersonasForAudience(audienceId: string) {
  const db = await getDb();
  return db.select().from(personas).where(eq(personas.audienceId, audienceId));
}

export async function reactionTally(experimentId: string): Promise<ReactionTally> {
  const db = await getDb();
  const rows = await db
    .select({
      interestScore: reactions.interestScore,
      purchaseIntent: reactions.purchaseIntent,
      priceReaction: reactions.priceReaction,
      wouldRecommend: reactions.wouldRecommend,
      isExtrapolated: reactions.isExtrapolated,
    })
    .from(reactions)
    .where(eq(reactions.experimentId, experimentId));
  return tallyFromRows(rows);
}

export async function countReactions(experimentId: string) {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(reactions).where(eq(reactions.experimentId, experimentId));
  return row?.n ?? 0;
}

export async function loadIdeaForExperiment(ideaId: string | null) {
  if (!ideaId) return undefined;
  const db = await getDb();
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  return idea;
}

export function parseVariantContent(raw: unknown): VariantContent {
  const c = raw as VariantContent;
  return {
    summary: c?.summary ?? "",
    valueProposition: c?.valueProposition ?? "",
    keyFeatures: Array.isArray(c?.keyFeatures) ? c.keyFeatures : [],
    pricingSummary: c?.pricingSummary ?? "",
    listedPrice: typeof c?.listedPrice === "number" ? c.listedPrice : null,
    currency: c?.currency ?? "USD",
    adHeadline: c?.adHeadline ?? "",
    adCopy: c?.adCopy ?? "",
  };
}
