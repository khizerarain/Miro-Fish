"use server";

import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experiments, jobs, reactions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { DEFAULT_COST_CAP_CENTS } from "./constants";
import { estimateSimulationJob } from "./cost";
import {
  countReactions,
  ensureControlVariant,
  getActiveSimulationJob,
  getExperimentForUser,
  listPersonasForAudience,
  loadIdeaForExperiment,
} from "./queries";
import { planAnchors, ensureSimulationJobRunning, snapshotSimulationJob, tickSimulationJob } from "@/jobs/simulate-reactions";
import type { SimulationSnapshot } from "./job-types";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();

export async function previewSimulationCost(experimentId: string) {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp?.audienceId) return { ok: false as const, error: "This experiment has no audience yet." };
  const people = await listPersonasForAudience(exp.audienceId);
  if (!people.length) return { ok: false as const, error: "Generate personas before running a simulation." };
  const estimate = estimateSimulationJob(people.length, env().MOCK_LLM);
  const cap = exp.costCapCents ?? DEFAULT_COST_CAP_CENTS;
  return { ok: true as const, estimate, cap, personaCount: people.length };
}

export async function startSimulation(experimentId: string): Promise<{ ok: true; jobId: string } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false, error: "Unknown experiment." };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp?.audienceId) return { ok: false, error: "This experiment has no audience yet." };

  const people = await listPersonasForAudience(exp.audienceId);
  if (!people.length) return { ok: false, error: "Generate personas before running a simulation." };

  const mock = env().MOCK_LLM;
  const estimate = estimateSimulationJob(people.length, mock);
  const cap = exp.costCapCents ?? DEFAULT_COST_CAP_CENTS;
  if (!mock && estimate.estimatedCostCents > cap) {
    return { ok: false, error: `Estimated cost is above this experiment's cap ($${(cap / 100).toFixed(0)}).` };
  }

  const running = await getActiveSimulationJob(experimentId);
  if (running && (running.status === "queued" || running.status === "simulating")) {
    return { ok: true, jobId: running.id };
  }
  if (running?.status === "cancelled") {
    const stored = await countReactions(experimentId);
    if (stored > 0) return resumeSimulation(experimentId);
  }

  const db = await getDb();
  const idea = await loadIdeaForExperiment(exp.ideaId);
  const variant = await ensureControlVariant(exp.id, idea);

  await db.delete(reactions).where(eq(reactions.experimentId, exp.id));
  await db
    .update(jobs)
    .set({ status: "cancelled", cancelRequestedAt: new Date(), finishedAt: new Date() })
    .where(and(eq(jobs.experimentId, exp.id), eq(jobs.type, "simulate"), inArray(jobs.status, ["queued", "simulating"])));

  const anchors = planAnchors(people, exp.seed);
  const [job] = await db
    .insert(jobs)
    .values({
      ownerId: user.id,
      type: "simulate",
      status: "queued",
      experimentId: exp.id,
      audienceId: exp.audienceId,
      ideaId: exp.ideaId,
      totalUnits: people.length,
      completedUnits: 0,
      checkpoint: {
        variantId: variant.id,
        anchorIds: anchors,
        positivityWarning: null,
      },
      startedAt: new Date(),
    })
    .returning({ id: jobs.id });

  await db
    .update(experiments)
    .set({
      status: "simulating",
      estimatedCostCents: estimate.estimatedCostCents,
      actualCostCents: 0,
      costCapCents: cap,
      completedAt: null,
    })
    .where(eq(experiments.id, exp.id));

  return { ok: true, jobId: job.id };
}

export async function pollSimulationJob(jobId: string): Promise<{ ok: true; snapshot: SimulationSnapshot } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(jobId).success) return { ok: false, error: "Unknown job." };
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, user.id))).limit(1);
  if (!job) return { ok: false, error: "This job no longer exists." };
  if (job.status === "queued" || job.status === "simulating") {
    await tickSimulationJob(job.id);
  }
  const snapshot = await snapshotSimulationJob(job.id);
  if (!snapshot) return { ok: false, error: "Couldn't read progress." };
  return { ok: true, snapshot };
}

export async function cancelSimulation(jobId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, user.id))).limit(1);
  if (!job) return { ok: false, error: "This job no longer exists." };
  if (job.status === "complete" || job.status === "failed") return { ok: true };
  await db
    .update(jobs)
    .set({ cancelRequestedAt: new Date(), status: "cancelled", finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
  if (job.experimentId) {
    await db.update(experiments).set({ status: "cancelled", completedAt: null }).where(eq(experiments.id, job.experimentId));
  }
  return { ok: true };
}

export async function resumeSimulation(experimentId: string): Promise<{ ok: true; jobId: string } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const job = await getActiveSimulationJob(experimentId);
  if (!job) return startSimulation(experimentId);
  if (job.status === "complete") return { ok: true, jobId: job.id };
  const db = await getDb();
  await db
    .update(jobs)
    .set({ status: "simulating", cancelRequestedAt: null, error: null, finishedAt: null })
    .where(eq(jobs.id, job.id));
  await db.update(experiments).set({ status: "simulating" }).where(eq(experiments.id, exp.id));
  after(() => ensureSimulationJobRunning(job.id));
  return { ok: true, jobId: job.id };
}

export async function fetchSimulationSnapshot(experimentId: string) {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false as const, error: "Unknown experiment." };
  const job = await getActiveSimulationJob(experimentId);
  if (!job) return { ok: false as const, error: "No simulation yet." };
  const snapshot = await snapshotSimulationJob(job.id);
  if (!snapshot) return { ok: false as const, error: "Couldn't read progress." };
  const stored = await countReactions(experimentId);
  return { ok: true as const, snapshot, stored };
}
