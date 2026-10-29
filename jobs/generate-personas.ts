import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { audiences, jobs, personas } from "@/db/schema";
import { allSkeletons } from "@/features/audiences/allocate";
import { PERSONA_BATCH_SIZE } from "@/features/audiences/constants";
import { firstWords, mergePersona } from "@/features/audiences/merge";
import { mockPersonaBatch } from "@/features/audiences/mock-personas";
import { parseDefinition } from "@/features/audiences/queries";
import {
  enabledSegments,
  personaBatchSchema,
  personaProfileSchema,
  type PersonaProfile,
  type PersonaSkeleton,
} from "@/features/audiences/schemas";
import { generateJson, LlmError } from "@/lib/llm";
import { generatePersonasV1 } from "@/prompts/generate-personas.v1";
import type { PersonaJobSnapshot } from "@/features/audiences/job-types";

type Checkpoint = { nextOrdinal: number };
type IdeaContext = { summary: string; industry: string; category: string };

const running = new Set<string>();
const chain = new Map<string, Promise<void>>();

/** Serialize work per job so polls and after() cannot overlap on PGlite. */
function enqueue(jobId: string, fn: () => Promise<void>) {
  const next = (chain.get(jobId) ?? Promise.resolve()).then(fn, fn);
  chain.set(jobId, next);
  return next;
}

export type { PersonaJobSnapshot };

function readCheckpoint(raw: unknown): Checkpoint {
  const p = z.object({ nextOrdinal: z.number().int().min(0) }).safeParse(raw);
  return p.success ? p.data : { nextOrdinal: 0 };
}

export async function snapshotPersonaJob(jobId: string): Promise<PersonaJobSnapshot | null> {
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job?.audienceId) return null;
  const [segRows, samples] = await Promise.all([
    db
      .select({ key: personas.segmentKey, n: count() })
      .from(personas)
      .where(eq(personas.audienceId, job.audienceId))
      .groupBy(personas.segmentKey),
    db
      .select({
        id: personas.id,
        ordinal: personas.ordinal,
        name: personas.name,
        age: personas.age,
        profession: personas.profession,
        location: personas.location,
        segmentKey: personas.segmentKey,
      })
      .from(personas)
      .where(eq(personas.audienceId, job.audienceId))
      .orderBy(desc(personas.ordinal))
      .limit(12),
  ]);
  const recent = [...samples].reverse();
  return {
    jobId: job.id,
    audienceId: job.audienceId,
    status: job.status as PersonaJobSnapshot["status"],
    total: job.totalUnits,
    completed: job.completedUnits,
    failed: job.failedUnits,
    error: job.error,
    segmentCounts: Object.fromEntries(segRows.map((r) => [r.key, r.n])),
    samples: recent,
  };
}

export async function ensurePersonaJobRunning(jobId: string) {
  return enqueue(jobId, async () => {
    if (running.has(jobId)) return;
    running.add(jobId);
    try {
      while (await processOneBatch(jobId)) {
        /* continue */
      }
    } finally {
      running.delete(jobId);
    }
  });
}

/** One batch, used by the progress poller when `after()` does not keep the loop alive. */
export async function tickPersonaJob(jobId: string) {
  return enqueue(jobId, async () => {
    if (running.has(jobId)) return;
    await processOneBatch(jobId);
  });
}

async function processOneBatch(jobId: string): Promise<boolean> {
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job?.audienceId) return false;
  if (job.cancelRequestedAt) {
    await finish(jobId, job.audienceId, "cancelled");
    return false;
  }
  if (job.status === "complete" || job.status === "failed" || job.status === "cancelled") return false;

  const [audience] = await db.select().from(audiences).where(eq(audiences.id, job.audienceId)).limit(1);
  if (!audience) return false;
  const def = parseDefinition(audience.definition);
  const checkpoint = readCheckpoint(job.checkpoint);
  if (checkpoint.nextOrdinal >= job.totalUnits) {
    await finish(jobId, audience.id, "complete");
    return false;
  }

  if (job.status === "queued") {
    await db
      .update(jobs)
      .set({ status: "generating", startedAt: job.startedAt ?? new Date() })
      .where(eq(jobs.id, jobId));
    await db.update(audiences).set({ status: "generating" }).where(eq(audiences.id, audience.id));
  }

  const end = Math.min(job.totalUnits, checkpoint.nextOrdinal + PERSONA_BATCH_SIZE);
  const skeletons = allSkeletons(audience.seed, def, job.totalUnits).slice(checkpoint.nextOrdinal, end);
  const ctx = (job.checkpoint as { idea?: IdeaContext } | null)?.idea ?? {
    summary: "",
    industry: "Unknown",
    category: "Unknown",
  };

  const existing = await db
    .select({ name: personas.name, ordinal: personas.ordinal, profile: personas.profile })
    .from(personas)
    .where(eq(personas.audienceId, audience.id));
  const usedNames = new Set(existing.map((p) => p.name.toLowerCase()));
  const usedOpeners = new Set<string>();
  for (const p of existing) {
    const profile = personaProfileSchema.safeParse(p.profile);
    if (profile.success) usedOpeners.add(firstWords(profile.data.backstory));
  }
  const existingOrdinals = new Set(existing.map((p) => p.ordinal));
  const toCreate = skeletons.filter((s) => !existingOrdinals.has(s.ordinal));
  if (toCreate.length === 0) {
    const nextOrdinal = end;
    const done = nextOrdinal >= job.totalUnits;
    await db
      .update(jobs)
      .set({ completedUnits: nextOrdinal, checkpoint: { nextOrdinal, idea: ctx }, status: done ? "complete" : "generating" })
      .where(eq(jobs.id, jobId));
    if (done) await db.update(audiences).set({ status: "ready" }).where(eq(audiences.id, audience.id));
    return !done;
  }

  try {
    const vars = varsFor(ctx, def, toCreate);
    const { data, usage } = await generateJson({
      prompt: generatePersonasV1,
      vars,
      schema: personaBatchSchema,
      mock: () => ({ personas: mockPersonaBatch(vars, toCreate) }),
      mockDelayMs: 280,
    });

    const byOrdinal = new Map(data.personas.map((p) => [p.ordinal, p]));
    const rows = toCreate.map((sk) => {
      const llm = byOrdinal.get(sk.ordinal) ?? {
        ordinal: sk.ordinal,
        name: `Persona ${sk.ordinal + 1}`,
        financialSituation: "Not described.",
        personalityTraits: ["practical", "cautious"],
        interests: sk.interestSeeds.slice(0, 2),
        needs: ["A simple way to solve the stated problem"],
        painPoints: ["Skeptical of new tools"],
        currentAlternatives: ["current workaround"],
        buyingBehavior: { style: "researcher" as const, priceSensitivity: "high" as const },
        backstory: `${sk.location} resident, age ${sk.age}, working as ${sk.profession}. They have not looked for a new tool lately and would need a clear reason to change.`,
      };
      const profile: PersonaProfile = mergePersona(sk, llm, usedNames, usedOpeners);
      return {
        audienceId: audience.id,
        ordinal: sk.ordinal,
        segmentKey: sk.segmentKey,
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        location: profile.location,
        profession: profile.profession,
        incomeBand: profile.incomeBand,
        techComfort: profile.techComfort,
        profile,
      };
    });

    if (rows.length) await db.insert(personas).values(rows);

    const nextOrdinal = end;
    const done = nextOrdinal >= job.totalUnits;
    await db
      .update(jobs)
      .set({
        completedUnits: nextOrdinal,
        checkpoint: { nextOrdinal, idea: ctx },
        attempts: job.attempts + 1,
        inputTokens: job.inputTokens + usage.inputTokens,
        outputTokens: job.outputTokens + usage.outputTokens,
        status: done ? "complete" : "generating",
        finishedAt: done ? new Date() : null,
      })
      .where(eq(jobs.id, jobId));
    if (done) await db.update(audiences).set({ status: "ready" }).where(eq(audiences.id, audience.id));
    return !done;
  } catch (err) {
    const message = err instanceof LlmError ? err.message : (err as Error).message;
    const failedUnits = job.failedUnits + 1;
    if (failedUnits >= 3) {
      await db
        .update(jobs)
        .set({ status: "failed", error: message.slice(0, 1000), failedUnits, finishedAt: new Date() })
        .where(eq(jobs.id, jobId));
      await db.update(audiences).set({ status: "failed" }).where(eq(audiences.id, audience.id));
      return false;
    }
    await db
      .update(jobs)
      .set({
        failedUnits,
        error: message.slice(0, 1000),
        checkpoint: { nextOrdinal: checkpoint.nextOrdinal, idea: ctx },
      })
      .where(eq(jobs.id, jobId));
    return true;
  }
}

function varsFor(ctx: IdeaContext, def: unknown, skeletons: PersonaSkeleton[]) {
  const parsed = parseDefinition(def);
  const legend = enabledSegments(parsed)
    .map((s) => `- ${s.key}: ${s.label}${s.rationale ? ` (${s.rationale})` : ""}`)
    .join("\n");
  const payload = skeletons.map((s) => ({
    ordinal: s.ordinal,
    segmentKey: s.segmentKey,
    age: s.age,
    gender: s.gender,
    location: s.location,
    profession: s.profession,
    incomeBand: s.incomeBand,
    techComfort: s.techComfort,
    interestHints: s.interestSeeds,
  }));
  return {
    productSummary: ctx.summary,
    industry: ctx.industry,
    category: ctx.category,
    segmentLegend: legend,
    skeletonsJson: JSON.stringify(payload),
    jsonSchema: JSON.stringify(z.toJSONSchema(personaBatchSchema)),
    count: skeletons.length,
  };
}

async function finish(jobId: string, audienceId: string, status: "complete" | "failed" | "cancelled") {
  const db = await getDb();
  await db.update(jobs).set({ status, finishedAt: new Date() }).where(eq(jobs.id, jobId));
  await db
    .update(audiences)
    .set({ status: status === "complete" ? "ready" : status === "cancelled" ? "draft" : "failed" })
    .where(eq(audiences.id, audienceId));
}

export function ideaContextFromAnalysis(analysis: unknown): IdeaContext {
  const a = analysis as { summary?: string; industry?: string; category?: string } | null;
  return {
    summary: a?.summary ?? "",
    industry: a?.industry ?? "Unknown",
    category: a?.category ?? "Unknown",
  };
}
