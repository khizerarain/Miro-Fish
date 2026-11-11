import "server-only";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { experiments, jobs } from "@/db/schema";
import { LIMITS } from "./rate-limit";

export async function usageSnapshot(userId: string) {
  const db = await getDb();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [active, jobsToday, tokens, cost] = await Promise.all([
    db
      .select({ n: count() })
      .from(experiments)
      .where(and(eq(experiments.ownerId, userId), isNull(experiments.archivedAt)))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(jobs)
      .where(and(eq(jobs.ownerId, userId), gte(jobs.createdAt, dayAgo)))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({
        input: sql<number>`coalesce(sum(${jobs.inputTokens}), 0)`,
        output: sql<number>`coalesce(sum(${jobs.outputTokens}), 0)`,
      })
      .from(jobs)
      .where(eq(jobs.ownerId, userId))
      .then((r) => r[0] ?? { input: 0, output: 0 }),
    db
      .select({ cost: sql<number>`coalesce(sum(${experiments.actualCostCents}), 0)` })
      .from(experiments)
      .where(eq(experiments.ownerId, userId))
      .then((r) => r[0]?.cost ?? 0),
  ]);
  return {
    activeExperiments: Number(active),
    experimentCap: LIMITS.experimentsActive,
    jobsToday: Number(jobsToday),
    jobsPerDayCap: LIMITS.jobsPerDay,
    inputTokens: Number(tokens.input),
    outputTokens: Number(tokens.output),
    actualCostCents: Number(cost),
  };
}

export async function assertExperimentRoom(userId: string) {
  const snap = await usageSnapshot(userId);
  if (snap.activeExperiments >= snap.experimentCap) {
    return `Active experiment cap reached (${snap.experimentCap}). Archive one to start another.`;
  }
  if (snap.jobsToday >= snap.jobsPerDayCap) {
    return `Daily job cap reached (${snap.jobsPerDayCap}). Try again tomorrow.`;
  }
  return null;
}
