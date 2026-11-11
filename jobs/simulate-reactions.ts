import "server-only";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experimentVariants, experiments, jobs, personas, reactions } from "@/db/schema";
import { pickAnchorIds } from "@/features/simulations/anchors";
import { compactPersona } from "@/features/simulations/compact";
import { ANCHOR_CAP, DEFAULT_COST_CAP_CENTS, SIMULATION_BATCH_SIZE, SIMULATION_CONCURRENCY } from "@/features/simulations/constants";
import { centsFromTokens } from "@/features/simulations/cost";
import { fallbackReaction, mockReactionBatch } from "@/features/simulations/mock-reactions";
import { POSITIVITY_RETRY_NOTE, positivityReport } from "@/features/simulations/positivity";
import {
  reactionBatchSchema,
  reactionPayloadSchema,
  type CompactPersona,
  type ReactionLlm,
  type VariantContent,
} from "@/features/simulations/schemas";
import { tallyFromRows } from "@/features/simulations/tally";
import type { ReactionSample, ReactionTally, SimulationSnapshot } from "@/features/simulations/job-types";
import { generateJson, LlmError } from "@/lib/llm";
import { rngFor } from "@/lib/seeded-rng";
import { simulateReactionsV1 } from "@/prompts/simulate-reactions.v1";

type Checkpoint = {
  variantId: string;
  anchorIds: string[] | "all";
  positivityWarning: string | null;
};

const running = new Set<string>();
const chain = new Map<string, Promise<void>>();
const WAVE_YIELD_MS = 480;

function enqueue(jobId: string, fn: () => Promise<void>) {
  const next = (chain.get(jobId) ?? Promise.resolve()).then(fn, fn);
  chain.set(jobId, next);
  return next;
}

async function stopIfCancelled(jobId: string, experimentId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ cancelRequestedAt: jobs.cancelRequestedAt })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!row?.cancelRequestedAt) return false;
  await finish(jobId, experimentId, "cancelled");
  return true;
}

function readCheckpoint(raw: unknown): Checkpoint | null {
  const p = z
    .object({
      variantId: z.uuid(),
      anchorIds: z.union([z.literal("all"), z.array(z.uuid())]),
      positivityWarning: z.string().nullable(),
    })
    .safeParse(raw);
  return p.success ? p.data : null;
}

export async function ensureSimulationJobRunning(jobId: string) {
  return enqueue(jobId, async () => {
    if (running.has(jobId)) return;
    running.add(jobId);
    try {
      const more = await processOneWave(jobId);
      if (more) {
        setTimeout(() => {
          void ensureSimulationJobRunning(jobId);
        }, WAVE_YIELD_MS);
      }
    } finally {
      running.delete(jobId);
    }
  });
}

export async function tickSimulationJob(jobId: string) {
  return enqueue(jobId, async () => {
    if (running.has(jobId)) return;
    await processOneWave(jobId);
  });
}

export async function snapshotSimulationJob(jobId: string): Promise<SimulationSnapshot | null> {
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job?.experimentId) return null;
  const cp = readCheckpoint(job.checkpoint);
  const [exp, tally, samples] = await Promise.all([
    db.select().from(experiments).where(eq(experiments.id, job.experimentId)).limit(1).then((r) => r[0]),
    loadTally(job.experimentId, cp?.variantId),
    loadSamples(job.experimentId, 12, cp?.variantId),
  ]);
  const total = job.totalUnits;
  const anchors = cp?.anchorIds === "all" ? total : (cp?.anchorIds.length ?? total);
  const stage =
    job.status === "queued"
      ? "queued"
      : job.status === "complete" || job.status === "failed" || job.status === "cancelled"
        ? job.status
        : tally.simulated >= anchors && tally.extrapolated < total - anchors
          ? "extrapolating"
          : "simulating";
  return {
    jobId: job.id,
    experimentId: job.experimentId,
    variantId: cp?.variantId ?? "",
    status: stage,
    stage,
    total,
    anchors,
    completed: job.completedUnits,
    failed: job.failedUnits,
    error: job.error,
    positivityWarning: cp?.positivityWarning ?? null,
    estimatedCostCents: exp?.estimatedCostCents ?? 0,
    actualCostCents: exp?.actualCostCents ?? 0,
    tally,
    samples,
  };
}

async function loadTally(experimentId: string, variantId?: string): Promise<ReactionTally> {
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
    .where(
      variantId
        ? and(eq(reactions.experimentId, experimentId), eq(reactions.variantId, variantId))
        : eq(reactions.experimentId, experimentId),
    );
  return tallyFromRows(rows);
}

async function loadSamples(experimentId: string, take: number, variantId?: string): Promise<ReactionSample[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: reactions.id,
      personaId: reactions.personaId,
      personaName: personas.name,
      segmentKey: personas.segmentKey,
      interestScore: reactions.interestScore,
      purchaseIntent: reactions.purchaseIntent,
      wouldRecommend: reactions.wouldRecommend,
      isExtrapolated: reactions.isExtrapolated,
      payload: reactions.payload,
    })
    .from(reactions)
    .innerJoin(personas, eq(personas.id, reactions.personaId))
    .where(
      variantId
        ? and(eq(reactions.experimentId, experimentId), eq(reactions.variantId, variantId))
        : eq(reactions.experimentId, experimentId),
    )
    .orderBy(desc(reactions.createdAt))
    .limit(take);
  return rows.map((r) => {
    const payload = reactionPayloadSchema.safeParse(r.payload);
    return {
      id: r.id,
      personaId: r.personaId,
      personaName: r.personaName,
      segmentKey: r.segmentKey,
      interestScore: r.interestScore,
      purchaseIntent: r.purchaseIntent,
      firstImpression: payload.success ? payload.data.firstImpression : "",
      wouldRecommend: r.wouldRecommend,
      isExtrapolated: r.isExtrapolated,
    };
  });
}

async function processOneWave(jobId: string): Promise<boolean> {
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job?.experimentId || !job.audienceId) return false;
  if (job.cancelRequestedAt || job.status === "cancelled") {
    await finish(jobId, job.experimentId, "cancelled");
    return false;
  }
  if (job.status === "complete" || job.status === "failed") return false;

  const cp = readCheckpoint(job.checkpoint);
  if (!cp) {
    await fail(jobId, job.experimentId, "Simulation checkpoint is missing.");
    return false;
  }

  const [exp] = await db.select().from(experiments).where(eq(experiments.id, job.experimentId)).limit(1);
  if (!exp) return false;
  const cap = exp.costCapCents ?? DEFAULT_COST_CAP_CENTS;

  if (job.status === "queued") {
    await db.update(jobs).set({ status: "simulating", startedAt: job.startedAt ?? new Date() }).where(eq(jobs.id, jobId));
    await db.update(experiments).set({ status: "simulating" }).where(eq(experiments.id, exp.id));
  }

  const [variant] = await db.select().from(experimentVariants).where(eq(experimentVariants.id, cp.variantId)).limit(1);
  if (!variant) {
    await fail(jobId, exp.id, "The experiment variant is missing.");
    return false;
  }
  const product = variant.content as VariantContent;

  const pending = await pendingAnchors(job.audienceId, cp.variantId, cp.anchorIds, SIMULATION_BATCH_SIZE * SIMULATION_CONCURRENCY);
  if (pending.length === 0) {
    if (await stopIfCancelled(jobId, job.experimentId)) return false;
    return extrapolateWave(job, cp);
  }

  const chunks: (typeof pending)[] = [];
  for (let i = 0; i < pending.length; i += SIMULATION_BATCH_SIZE) {
    chunks.push(pending.slice(i, i + SIMULATION_BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const out = await simulateChunk(chunk, product, exp.seed);
        return { chunk, ...out, error: null as string | null };
      } catch (err) {
        const message = err instanceof LlmError ? err.message : (err as Error).message;
        return {
          chunk,
          reactions: null as ReactionLlm[] | null,
          warning: null as string | null,
          inputTokens: 0,
          outputTokens: 0,
          error: message,
        };
      }
    }),
  );

  let warning = cp.positivityWarning;
  let failedUnits = job.failedUnits;
  let inputTokens = job.inputTokens;
  let outputTokens = job.outputTokens;
  const hardFail = results.filter((r) => !r.reactions);
  if (hardFail.length) failedUnits += hardFail.length;

  for (const result of results) {
    const people = result.chunk.map(compactPersona);
    const batch = result.reactions ?? (failedUnits >= 3 ? people.map(fallbackReaction) : null);
    if (!batch) continue;
    if (result.warning) warning = result.warning;
    else {
      const report = positivityReport(batch);
      if (report.tooPositive) warning = `Batch looked unusually upbeat (${report.reasons.join("; ")}). Treat as a hypothesis.`;
    }
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    const byOrdinal = new Map(batch.map((r) => [r.ordinal, r]));
    const rows = people.map((sk) => {
      const llm = byOrdinal.get(sk.ordinal) ?? fallbackReaction(sk);
      const payload = reactionPayloadSchema.parse({
        ...llm,
        personaId: sk.id,
        extrapolatedFromPersonaId: null,
        fallback: !byOrdinal.has(sk.ordinal),
      });
      return {
        experimentId: exp.id,
        variantId: cp.variantId,
        personaId: sk.id,
        interestScore: payload.interestScore,
        purchaseIntent: payload.purchaseIntent,
        priceReaction: payload.priceReaction,
        willingnessToPay: payload.willingnessToPay,
        wouldRecommend: payload.wouldRecommend,
        isExtrapolated: false,
        payload,
      };
    });
    if (rows.length) await db.insert(reactions).values(rows).onConflictDoNothing();
  }

  const stored = await db
    .select({ n: count() })
    .from(reactions)
    .where(and(eq(reactions.experimentId, exp.id), eq(reactions.variantId, cp.variantId)))
    .then((r) => r[0]?.n ?? 0);

  const actualCostCents = centsFromTokens(inputTokens, outputTokens);
  if (actualCostCents >= cap && (exp.estimatedCostCents ?? 0) > 0) {
    await db.update(jobs).set({ inputTokens, outputTokens, completedUnits: stored }).where(eq(jobs.id, jobId));
    await db.update(experiments).set({ actualCostCents }).where(eq(experiments.id, exp.id));
    await fail(jobId, exp.id, "Stopped at the cost cap. Reactions already stored are kept.");
    return false;
  }

  await db
    .update(jobs)
    .set({
      completedUnits: stored,
      failedUnits,
      checkpoint: { ...cp, positivityWarning: warning },
      error: hardFail[0]?.error?.slice(0, 1000) ?? null,
      inputTokens,
      outputTokens,
    })
    .where(eq(jobs.id, jobId));
  await db.update(experiments).set({ actualCostCents }).where(eq(experiments.id, exp.id));
  if (await stopIfCancelled(jobId, exp.id)) return false;
  await db.update(jobs).set({ status: "simulating" }).where(eq(jobs.id, jobId));
  return true;
}

type PersonaRow = typeof personas.$inferSelect;

async function pendingAnchors(
  audienceId: string,
  variantId: string,
  anchorIds: string[] | "all",
  limit: number,
): Promise<PersonaRow[]> {
  const db = await getDb();
  const filters = [eq(personas.audienceId, audienceId), isNull(reactions.id)];
  if (anchorIds !== "all") {
    if (anchorIds.length === 0) return [];
    filters.push(inArray(personas.id, anchorIds));
  }
  return db
    .select({ persona: personas })
    .from(personas)
    .leftJoin(reactions, and(eq(reactions.personaId, personas.id), eq(reactions.variantId, variantId)))
    .where(and(...filters))
    .orderBy(asc(personas.ordinal))
    .limit(limit)
    .then((rows) => rows.map((r) => r.persona));
}

async function simulateChunk(chunk: PersonaRow[], product: VariantContent, seed: number) {
  const people = chunk.map(compactPersona);
  const first = await generateJson({
    prompt: simulateReactionsV1,
    vars: varsFor(product, people, ""),
    schema: reactionBatchSchema,
    mock: () => ({ reactions: mockReactionBatch(people, product, seed) }),
    mockDelayMs: 780,
  });
  let batch = first.data.reactions;
  let inputTokens = first.usage.inputTokens;
  let outputTokens = first.usage.outputTokens;
  const report = positivityReport(batch);
  let warning: string | null = null;
  if (report.tooPositive) {
    const retry = await generateJson({
      prompt: simulateReactionsV1,
      vars: varsFor(product, people, POSITIVITY_RETRY_NOTE),
      schema: reactionBatchSchema,
      mock: () => ({ reactions: mockReactionBatch(people, product, seed + 17) }),
      mockDelayMs: 280,
    });
    inputTokens += retry.usage.inputTokens;
    outputTokens += retry.usage.outputTokens;
    const second = positivityReport(retry.data.reactions);
    if (!second.tooPositive || second.meanInterest < report.meanInterest) batch = retry.data.reactions;
    const final = positivityReport(batch);
    if (final.tooPositive) warning = `Batch looked unusually upbeat (${final.reasons.join("; ")}). Treat as a hypothesis.`;
  }
  return { reactions: batch, warning, inputTokens, outputTokens };
}

async function extrapolateWave(job: typeof jobs.$inferSelect, cp: Checkpoint): Promise<boolean> {
  if (!job.experimentId || !job.audienceId) return false;
  const db = await getDb();
  if (cp.anchorIds === "all") {
    if (await stopIfCancelled(job.id, job.experimentId)) return false;
    await finish(job.id, job.experimentId, "complete");
    return false;
  }

  const remaining = await db
    .select({ persona: personas })
    .from(personas)
    .leftJoin(reactions, and(eq(reactions.personaId, personas.id), eq(reactions.variantId, cp.variantId)))
    .where(and(eq(personas.audienceId, job.audienceId), isNull(reactions.id)))
    .orderBy(asc(personas.ordinal))
    .limit(200)
    .then((rows) => rows.map((r) => r.persona));

  if (remaining.length === 0) {
    if (await stopIfCancelled(job.id, job.experimentId)) return false;
    await finish(job.id, job.experimentId, "complete");
    return false;
  }

  const donors = await db
    .select({
      personaId: reactions.personaId,
      segmentKey: personas.segmentKey,
      interestScore: reactions.interestScore,
      purchaseIntent: reactions.purchaseIntent,
      priceReaction: reactions.priceReaction,
      willingnessToPay: reactions.willingnessToPay,
      wouldRecommend: reactions.wouldRecommend,
      payload: reactions.payload,
    })
    .from(reactions)
    .innerJoin(personas, eq(personas.id, reactions.personaId))
    .where(
      and(eq(reactions.experimentId, job.experimentId), eq(reactions.variantId, cp.variantId), eq(reactions.isExtrapolated, false)),
    );

  if (!donors.length) {
    await fail(job.id, job.experimentId, "Nothing to extrapolate from.");
    return false;
  }

  const bySeg = new Map<string, typeof donors>();
  for (const d of donors) {
    const list = bySeg.get(d.segmentKey) ?? [];
    list.push(d);
    bySeg.set(d.segmentKey, list);
  }

  const rows = remaining.map((p) => {
    const pool = bySeg.get(p.segmentKey)?.length ? bySeg.get(p.segmentKey)! : donors;
    const rng = rngFor(p.ordinal, job.experimentId ?? "ex", "extrap");
    const donor = pool[Math.floor(rng() * pool.length)]!;
    const parsed = reactionPayloadSchema.safeParse(donor.payload);
    const jitter = Math.round((rng() - 0.5) * 12);
    const score = Math.max(0, Math.min(100, donor.interestScore + jitter));
    const payload = reactionPayloadSchema.parse({
      ...(parsed.success ? parsed.data : fallbackReaction(compactPersona(p))),
      ordinal: p.ordinal,
      personaId: p.id,
      interestScore: score,
      firstImpression: (
        parsed.success
          ? `[Extrapolated from a similar persona in this segment] ${parsed.data.firstImpression}`
          : fallbackReaction(compactPersona(p)).firstImpression
      ).slice(0, 400),
      extrapolatedFromPersonaId: donor.personaId,
      fallback: false,
    });
    return {
      experimentId: job.experimentId!,
      variantId: cp.variantId,
      personaId: p.id,
      interestScore: payload.interestScore,
      purchaseIntent: payload.purchaseIntent,
      priceReaction: payload.priceReaction,
      willingnessToPay: payload.willingnessToPay,
      wouldRecommend: payload.wouldRecommend,
      isExtrapolated: true,
      payload,
    };
  });

  if (rows.length) await db.insert(reactions).values(rows).onConflictDoNothing();
  const stored = await db
    .select({ n: count() })
    .from(reactions)
    .where(and(eq(reactions.experimentId, job.experimentId), eq(reactions.variantId, cp.variantId)))
    .then((r) => r[0]?.n ?? 0);
  await db.update(jobs).set({ completedUnits: stored }).where(eq(jobs.id, job.id));
  if (await stopIfCancelled(job.id, job.experimentId)) return false;
  await db.update(jobs).set({ status: "simulating" }).where(eq(jobs.id, job.id));
  return stored < job.totalUnits;
}

function varsFor(product: VariantContent, people: CompactPersona[], extra: string) {
  const personasXml = people
    .map(
      (p, i) => `<persona index="${i + 1}" ordinal="${p.ordinal}">
name: ${p.name}
age: ${p.age}; gender: ${p.gender ?? "unspecified"}; location: ${p.location ?? ""}
profession: ${p.profession ?? ""}; income: ${p.incomeBand ?? ""}; techComfort: ${p.techComfort ?? ""}/5
segment: ${p.segmentKey}
traits: ${p.traits.join(", ")}
needs: ${p.needs.join("; ")}
painPoints: ${p.painPoints.join("; ")}
usesToday: ${p.alternatives.join("; ")}
buying: ${p.buyingStyle}, ${p.priceSensitivity} price sensitivity
money: ${p.financial}
</persona>`,
    )
    .join("\n\n");
  return {
    productJson: JSON.stringify(product),
    personasXml,
    jsonSchema: JSON.stringify(z.toJSONSchema(reactionBatchSchema)),
    count: people.length,
    extraInstruction: extra,
  };
}

async function finish(jobId: string, experimentId: string, status: "complete" | "failed" | "cancelled") {
  const db = await getDb();
  await db.update(jobs).set({ status, finishedAt: new Date() }).where(eq(jobs.id, jobId));
  await db
    .update(experiments)
    .set({
      status,
      completedAt: status === "complete" ? new Date() : null,
    })
    .where(eq(experiments.id, experimentId));
}

async function fail(jobId: string, experimentId: string, message: string) {
  const db = await getDb();
  await db.update(jobs).set({ status: "failed", error: message.slice(0, 1000), finishedAt: new Date() }).where(eq(jobs.id, jobId));
  await db.update(experiments).set({ status: "failed" }).where(eq(experiments.id, experimentId));
}

export function planAnchors(personasList: { id: string; segmentKey: string; ordinal: number }[], seed: number) {
  if (personasList.length <= ANCHOR_CAP) return "all" as const;
  return pickAnchorIds(personasList, seed, ANCHOR_CAP);
}

export type { Checkpoint };
