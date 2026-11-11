"use server";

import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { insights, jobs } from "@/db/schema";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { ensureAnalysisJobRunning, snapshotAnalysisJob, tickAnalysisJob } from "@/jobs/analyze-results";
import type { AnalysisSnapshot } from "@/jobs/analyze-results";
import {
  getActiveAnalysisJob,
  getExperimentForUser,
  loadCompactReactions,
  loadNarrative,
  loadSegmentLabels,
} from "./queries";
import { makeShareToken } from "./share";
import { loadLatestReality } from "@/features/reality/actions";
import type { CompactReaction, NarrativePayload } from "./schemas";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();

export type DashboardPayload = {
  experimentId: string;
  experimentName: string;
  runStatus: string;
  mockMode: boolean;
  rows: CompactReaction[];
  segmentLabels: Record<string, string>;
  narrative: NarrativePayload | null;
  analysis: AnalysisSnapshot | null;
  listedPrice: number | null;
  sharePath: string;
  simulateHref: string;
  audienceHref: string;
  variantsHref: string;
  compareHref: string;
  notesHref: string;
  historyHref: string | null;
  reality: import("@/features/reality/schemas").RealityCompare | null;
};

export async function loadDashboard(experimentId: string): Promise<{ ok: true; data: DashboardPayload } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false, error: "Unknown experiment." };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const [rows, labels, narrative, analysisJob, reality] = await Promise.all([
    loadCompactReactions(exp.id),
    loadSegmentLabels(exp.audienceId),
    loadNarrative(exp.id),
    getActiveAnalysisJob(exp.id),
    loadLatestReality(exp.id),
  ]);
  const analysis = analysisJob ? await snapshotAnalysisJob(analysisJob.id) : null;
  return {
    ok: true,
    data: {
      experimentId: exp.id,
      experimentName: exp.name,
      runStatus: exp.status,
      mockMode: env().MOCK_LLM,
      rows,
      segmentLabels: labels,
      narrative,
      analysis,
      listedPrice: null,
      sharePath: `/s/${makeShareToken(exp.id)}`,
      simulateHref: `/experiments/${exp.id}/simulate`,
      audienceHref: `/experiments/${exp.id}/audience`,
      variantsHref: `/experiments/${exp.id}/variants`,
      compareHref: `/experiments/${exp.id}/compare`,
      notesHref: `/experiments/${exp.id}/notes`,
      historyHref: exp.projectId ? `/projects/${exp.projectId}` : "/projects",
      reality: reality.ok ? reality.compare : null,
    },
  };
}

export async function startAnalysis(experimentId: string): Promise<{ ok: true; jobId: string } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const stored = await loadCompactReactions(exp.id);
  if (!stored.length) return { ok: false, error: "No stored reactions to analyze." };

  const existing = await getActiveAnalysisJob(exp.id);
  if (existing && (existing.status === "queued" || existing.status === "analyzing")) {
    after(() => ensureAnalysisJobRunning(existing.id));
    return { ok: true, jobId: existing.id };
  }
  if (existing?.status === "complete") {
    const notes = await loadNarrative(exp.id);
    if (notes) return { ok: true, jobId: existing.id };
  }

  const db = await getDb();
  const [job] = await db
    .insert(jobs)
    .values({
      ownerId: user.id,
      type: "analyze_results",
      status: "queued",
      experimentId: exp.id,
      audienceId: exp.audienceId,
      ideaId: exp.ideaId,
      totalUnits: 1,
      startedAt: new Date(),
    })
    .returning({ id: jobs.id });

  after(() => ensureAnalysisJobRunning(job.id));
  return { ok: true, jobId: job.id };
}

export async function pollAnalysis(jobId: string): Promise<{ ok: true; snapshot: AnalysisSnapshot; narrative: NarrativePayload | null } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(jobId).success) return { ok: false, error: "Unknown job." };
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, user.id))).limit(1);
  if (!job) return { ok: false, error: "This job no longer exists." };
  if (job.status === "queued" || job.status === "analyzing") await tickAnalysisJob(job.id);
  const snapshot = await snapshotAnalysisJob(job.id);
  if (!snapshot) return { ok: false, error: "Couldn't read progress." };
  const narrative = job.experimentId ? await loadNarrative(job.experimentId) : null;
  return { ok: true, snapshot, narrative };
}

export async function retryAnalysis(experimentId: string): Promise<{ ok: true; jobId: string } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "Unknown experiment." };
  const db = await getDb();
  await db.delete(insights).where(eq(insights.experimentId, exp.id));
  await db
    .update(jobs)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(jobs.experimentId, exp.id), eq(jobs.type, "analyze_results")));
  return startAnalysis(experimentId);
}
