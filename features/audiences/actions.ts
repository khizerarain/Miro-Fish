"use server";

import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { audiences, experiments, ideas, jobs, personas } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { estimatePersonaJob } from "./cost";
import {
  audienceDefinitionSchema,
  audienceSizeSchema,
  type AudienceDefinition,
} from "./schemas";
import {
  ensureAudience,
  getActiveJob,
  getOwnedAudience,
  listAudiences,
  listPersonas,
  listTemplates,
  parseDefinition,
  personaCounts,
  type PersonaListFilter,
} from "./queries";
import {
  ensurePersonaJobRunning,
  ideaContextFromAnalysis,
  snapshotPersonaJob,
  tickPersonaJob,
} from "@/jobs/generate-personas";
import type { PersonaJobSnapshot } from "./job-types";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();

export async function ensureAudienceForExperiment(experimentId: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false as const, error: "Unknown experiment." };
  const state = await ensureAudience(user.id, experimentId);
  return state ? { ok: true as const, state } : { ok: false as const, error: "This experiment no longer exists." };
}

export async function saveAudienceDraft(
  audienceId: string,
  raw: { name?: string; size?: number; definition?: AudienceDefinition },
): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const row = await getOwnedAudience(user.id, audienceId);
  if (!row) return { ok: false, error: "This audience no longer exists." };
  if (row.status === "generating") return { ok: false, error: "Wait for generation to finish before editing." };

  const patch: Partial<typeof audiences.$inferInsert> = {};
  if (raw.name !== undefined) patch.name = raw.name.trim().slice(0, 80) || row.name;
  if (raw.size !== undefined) {
    const size = audienceSizeSchema.safeParse(raw.size);
    if (!size.success) return { ok: false, error: "Choose 100, 500, 1,000, or 5,000 people." };
    patch.size = size.data;
  }
  if (raw.definition !== undefined) {
    const def = audienceDefinitionSchema.safeParse(raw.definition);
    if (!def.success) return { ok: false, error: def.error.issues[0]?.message ?? "Invalid audience." };
    patch.definition = def.data;
  }
  const db = await getDb();
  await db.update(audiences).set(patch).where(eq(audiences.id, audienceId));
  return { ok: true };
}

export async function startPersonaGeneration(audienceId: string): Promise<{ ok: true; jobId: string } | Fail> {
  const user = await requireUser();
  const row = await getOwnedAudience(user.id, audienceId);
  if (!row) return { ok: false, error: "This audience no longer exists." };
  const def = audienceDefinitionSchema.safeParse(row.definition);
  if (!def.success) return { ok: false, error: def.error.issues[0]?.message ?? "Fix the audience before generating." };

  const db = await getDb();
  const [exp] = await db.select().from(experiments).where(eq(experiments.audienceId, audienceId)).limit(1);
  const idea = exp?.ideaId ? (await db.select().from(ideas).where(eq(ideas.id, exp.ideaId)).limit(1))[0] : undefined;

  await db.delete(personas).where(eq(personas.audienceId, audienceId));
  await db
    .update(jobs)
    .set({ status: "cancelled", cancelRequestedAt: new Date(), finishedAt: new Date() })
    .where(and(eq(jobs.audienceId, audienceId), inArray(jobs.status, ["queued", "generating"])));

  const estimate = estimatePersonaJob(row.size, env().MOCK_LLM);
  const [job] = await db
    .insert(jobs)
    .values({
      ownerId: user.id,
      type: "generate_personas",
      status: "queued",
      audienceId,
      experimentId: exp?.id,
      ideaId: exp?.ideaId,
      totalUnits: row.size,
      completedUnits: 0,
      checkpoint: { nextOrdinal: 0, idea: ideaContextFromAnalysis(idea?.analysis) },
      startedAt: new Date(),
    })
    .returning({ id: jobs.id });

  await db.update(audiences).set({ status: "generating" }).where(eq(audiences.id, audienceId));
  if (exp) {
    await db
      .update(experiments)
      .set({ estimatedCostCents: estimate.estimatedCostCents })
      .where(eq(experiments.id, exp.id));
  }

  await tickPersonaJob(job.id);
  return { ok: true, jobId: job.id };
}

export async function pollPersonaJob(jobId: string): Promise<{ ok: true; snapshot: PersonaJobSnapshot } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(jobId).success) return { ok: false, error: "Unknown job." };
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, user.id))).limit(1);
  if (!job) return { ok: false, error: "This job no longer exists." };
  if (job.status === "queued" || job.status === "generating") {
    await tickPersonaJob(job.id);
  }
  const snapshot = await snapshotPersonaJob(job.id);
  if (!snapshot) return { ok: false, error: "Couldn't read progress." };
  return { ok: true, snapshot };
}

export async function cancelPersonaJob(jobId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, user.id))).limit(1);
  if (!job) return { ok: false, error: "This job no longer exists." };
  await db.update(jobs).set({ cancelRequestedAt: new Date() }).where(eq(jobs.id, jobId));
  return { ok: true };
}

export async function resumePersonaJob(audienceId: string): Promise<{ ok: true; jobId: string } | Fail> {
  const user = await requireUser();
  const row = await getOwnedAudience(user.id, audienceId);
  if (!row) return { ok: false, error: "This audience no longer exists." };
  const job = await getActiveJob(audienceId);
  if (!job) return startPersonaGeneration(audienceId);
  if (job.status === "complete") return { ok: true, jobId: job.id };
  await getDb().then((db) =>
    db.update(jobs).set({ status: "generating", cancelRequestedAt: null, error: null }).where(eq(jobs.id, job.id)),
  );
  after(() => ensurePersonaJobRunning(job.id));
  return { ok: true, jobId: job.id };
}

export async function saveAudienceTemplate(audienceId: string, name: string): Promise<{ ok: true; templateId: string } | Fail> {
  const user = await requireUser();
  const row = await getOwnedAudience(user.id, audienceId);
  if (!row) return { ok: false, error: "This audience no longer exists." };
  const db = await getDb();
  const [created] = await db
    .insert(audiences)
    .values({
      ownerId: user.id,
      name: (name.trim() || `${row.name} template`).slice(0, 80),
      definition: row.definition,
      size: row.size,
      seed: row.seed,
      isTemplate: true,
      status: "draft",
    })
    .returning({ id: audiences.id });
  return { ok: true, templateId: created.id };
}

export async function applyTemplate(audienceId: string, templateId: string): Promise<{ ok: true; definition: AudienceDefinition; size: number } | Fail> {
  const user = await requireUser();
  const [row, template] = await Promise.all([
    getOwnedAudience(user.id, audienceId),
    getOwnedAudience(user.id, templateId),
  ]);
  if (!row || !template?.isTemplate) return { ok: false, error: "Template not found." };
  const definition = parseDefinition(template.definition);
  const db = await getDb();
  await db
    .update(audiences)
    .set({ definition, size: template.size, seed: template.seed })
    .where(eq(audiences.id, audienceId));
  return { ok: true, definition, size: template.size };
}

export async function fetchPersonaPage(audienceId: string, filter: PersonaListFilter) {
  const user = await requireUser();
  const row = await getOwnedAudience(user.id, audienceId);
  if (!row) return { ok: false as const, error: "Unknown audience." };
  const [page, charts] = await Promise.all([listPersonas(audienceId, filter), personaCounts(audienceId)]);
  return { ok: true as const, page, charts };
}

export async function fetchTemplates() {
  const user = await requireUser();
  return listTemplates(user.id);
}

export async function fetchAudienceList() {
  const user = await requireUser();
  return listAudiences(user.id);
}

