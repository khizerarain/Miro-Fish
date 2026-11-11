import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { audiences, experimentVariants, experiments, insights, jobs, personas, reactions } from "@/db/schema";
import { parseDefinition } from "@/features/audiences/queries";
import { compactFromJoin } from "./compact";
import { narrativePayloadSchema, type CompactReaction, type NarrativePayload } from "./schemas";

export async function getExperimentById(experimentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(experimentId)) return null;
  const db = await getDb();
  const [row] = await db.select().from(experiments).where(eq(experiments.id, experimentId)).limit(1);
  return row ?? null;
}

export async function getExperimentForUser(userId: string, experimentId: string) {
  const exp = await getExperimentById(experimentId);
  if (!exp || exp.ownerId !== userId) return null;
  return exp;
}

export async function resolveControlVariantId(experimentId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: experimentVariants.id })
    .from(experimentVariants)
    .where(and(eq(experimentVariants.experimentId, experimentId), eq(experimentVariants.isControl, true)))
    .limit(1);
  return row?.id ?? null;
}

export async function loadCompactReactions(experimentId: string, variantId?: string | null): Promise<CompactReaction[]> {
  const db = await getDb();
  const vid = variantId ?? (await resolveControlVariantId(experimentId));
  const rows = await db
    .select({
      id: reactions.id,
      personaId: reactions.personaId,
      variantId: reactions.variantId,
      personaName: personas.name,
      segmentKey: personas.segmentKey,
      age: personas.age,
      incomeBand: personas.incomeBand,
      interestScore: reactions.interestScore,
      purchaseIntent: reactions.purchaseIntent,
      priceReaction: reactions.priceReaction,
      willingnessToPay: reactions.willingnessToPay,
      wouldRecommend: reactions.wouldRecommend,
      isExtrapolated: reactions.isExtrapolated,
      payload: reactions.payload,
    })
    .from(reactions)
    .innerJoin(personas, eq(personas.id, reactions.personaId))
    .where(
      vid
        ? and(eq(reactions.experimentId, experimentId), eq(reactions.variantId, vid))
        : eq(reactions.experimentId, experimentId),
    );
  return rows.map(compactFromJoin);
}

export async function loadSegmentLabels(audienceId: string | null): Promise<Record<string, string>> {
  if (!audienceId) return {};
  const db = await getDb();
  const [aud] = await db.select().from(audiences).where(eq(audiences.id, audienceId)).limit(1);
  if (!aud) return {};
  const def = parseDefinition(aud.definition);
  return Object.fromEntries(def.segments.map((s) => [s.key, s.label]));
}

export async function loadNarrative(experimentId: string): Promise<NarrativePayload | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.experimentId, experimentId), eq(insights.kind, "headline")))
    .orderBy(desc(insights.createdAt))
    .limit(1);
  if (!row) return null;
  const parsed = narrativePayloadSchema.safeParse(row.payload);
  return parsed.success ? parsed.data : null;
}

export async function getActiveAnalysisJob(experimentId: string) {
  const db = await getDb();
  const inflight = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.experimentId, experimentId), eq(jobs.type, "analyze_results")))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return inflight[0] ?? null;
}
