import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { experiments, githubInstallations, githubPrRuns, githubRepos, jobs, personas } from "@/db/schema";
import { ensureSimulationJobRunning, planAnchors, snapshotSimulationJob } from "@/jobs/simulate-reactions";
import { computeDashboard } from "@/features/results/compute";
import { loadNarrative } from "@/features/results/queries";
import { loadCompactReactions } from "@/features/results/queries";
import { env } from "@/lib/env";
import { changeBriefSchema, type ChangeBrief } from "./brief";
import { renderCheckSummary, renderComment, renderSkippedSummary } from "./comment";
import { buildChangeBrief, listPrFiles } from "./diff";
import { commentNote, completeCheckRun, startCheckRun, upsertComment } from "./publish";
import { enqueueSimulationForContent } from "./simulate";
import { loadAudienceRow } from "./queries";

const MAX_STEPS = 60;
/** How long one invocation waits for a simulation before handing off to the poller. */
const SIMULATION_WAIT_MS = 90_000;
const SIMULATION_POLL_MS = 1_500;

const active = new Set<string>();
const resumeTimers = new Map<string, NodeJS.Timeout>();

/**
 * Drives one PR review as far as it can go. Each step does a bounded unit of work and persists its
 * progress, so a crashed request loses at most one step.
 *
 * While a simulation is running this waits (with a deadline). If the deadline passes — a large
 * audience, or a serverless timeout — `scheduleResume` keeps nudging the run so it still finishes
 * without depending on someone having the dashboard open.
 */
export async function advancePrRun(runId: string): Promise<void> {
  if (active.has(runId)) return;
  active.add(runId);
  try {
    const deadline = Date.now() + SIMULATION_WAIT_MS;
    for (let i = 0; i < MAX_STEPS; i++) {
      const result = await step(runId);

      if (result === "done") {
        cancelResume(runId);
        return;
      }
      if (result === "waiting") {
        if (Date.now() >= deadline) {
          scheduleResume(runId);
          return;
        }
        await new Promise((r) => setTimeout(r, SIMULATION_POLL_MS));
        continue;
      }
      // "continue": loop straight into the next step.
    }
    scheduleResume(runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const db = await getDb();
    await db
      .update(githubPrRuns)
      .set({ status: "failed", statusDetail: message.slice(0, 800), updatedAt: new Date() })
      .where(eq(githubPrRuns.id, runId));
    cancelResume(runId);
  } finally {
    active.delete(runId);
  }
}

/** Re-enters the pipeline shortly. Keeps a slow simulation moving without a live request. */
export function scheduleResume(runId: string, delayMs = 5_000) {
  if (resumeTimers.has(runId)) return;
  const timer = setTimeout(() => {
    resumeTimers.delete(runId);
    void advancePrRun(runId);
  }, delayMs);
  // Do not hold the process open just to poll.
  timer.unref?.();
  resumeTimers.set(runId, timer);
}

function cancelResume(runId: string) {
  const timer = resumeTimers.get(runId);
  if (timer) {
    clearTimeout(timer);
    resumeTimers.delete(runId);
  }
}

type Run = typeof githubPrRuns.$inferSelect;
type Repo = typeof githubRepos.$inferSelect;
type Installation = typeof githubInstallations.$inferSelect;

const TERMINAL = new Set<Run["status"]>(["complete", "failed", "skipped", "cancelled"]);

type StepResult = "done" | "continue" | "waiting";

/** One bounded unit of work. */
async function step(runId: string): Promise<StepResult> {
  const db = await getDb();
  const [run] = await db.select().from(githubPrRuns).where(eq(githubPrRuns.id, runId)).limit(1);
  if (!run || TERMINAL.has(run.status)) return "done";

  const [repo] = await db.select().from(githubRepos).where(eq(githubRepos.id, run.repoId)).limit(1);
  if (!repo) return "done";
  const [inst] = await db.select().from(githubInstallations).where(eq(githubInstallations.id, repo.installationId)).limit(1);
  if (!inst) return "done";
  if (inst.suspendedAt) {
    await stop(run, repo, inst, "cancelled", "The GitHub App installation is suspended.");
    return "done";
  }

  switch (run.status) {
    case "queued":
      return startBriefing(run, repo, inst);
    case "briefing":
      return stepBriefing(run, repo, inst);
    case "simulating":
      return stepSimulating(run, repo, inst);
    case "analyzing":
      return stepAnalyzing(run, repo, inst);
    default:
      return "done";
  }
}

async function startBriefing(run: Run, repo: Repo, inst: Installation): Promise<StepResult> {
  const db = await getDb();
  const audience = repo.audienceId ? await loadAudienceRow(repo.audienceId) : null;

  if (!audience) {
    await stop(run, repo, inst, "skipped", "No audience connected to this repository yet.");
    return "done";
  }
  if (audience.status === "generating") {
    await stop(run, repo, inst, "skipped", "The connected audience is still generating personas. Re-run once it's ready.");
    return "done";
  }
  if (!(await hasPersonas(audience.id))) {
    await stop(run, repo, inst, "skipped", "The connected audience has no generated personas yet.");
    return "done";
  }

  let checkRunId = run.checkRunId;
  if (repo.checkEnabled && run.headSha) {
    const check = await startCheckRun({
      installationId: inst.installationId,
      fullName: repo.fullName,
      headSha: run.headSha,
      title: run.prTitle.slice(0, 140),
    }).catch(() => null);
    checkRunId = check?.id ?? checkRunId;
  }

  await db.update(githubPrRuns).set({ status: "briefing", checkRunId, updatedAt: new Date() }).where(eq(githubPrRuns.id, run.id));
  return "continue";
}

async function stepBriefing(run: Run, repo: Repo, inst: Installation): Promise<StepResult> {
  const db = await getDb();
  const brief = run.brief ? changeBriefSchema.safeParse(run.brief) : null;

  if (!brief?.success) {
    const files = await listPrFiles(inst.installationId, repo.fullName, run.prNumber);
    const built = await buildChangeBrief({
      installationId: inst.installationId,
      fullName: repo.fullName,
      prNumber: run.prNumber,
      title: run.prTitle,
      body: run.prBody ?? "",
      files,
    });
    await db
      .update(githubPrRuns)
      .set({
        brief: { ...built.brief, truncated: built.truncated },
        filesChanged: files.length,
        additions: files.reduce((s, f) => s + f.additions, 0),
        deletions: files.reduce((s, f) => s + f.deletions, 0),
        updatedAt: new Date(),
      })
      .where(eq(githubPrRuns.id, run.id));

    if (!built.brief.customerVisible) {
      await skipInternalOnly(run, repo, inst, built.brief);
      return "done";
    }
    return "continue";
  }

  // Brief exists from a previous step: decide and move on.
  if (!brief.data.customerVisible) {
    await skipInternalOnly(run, repo, inst, brief.data);
    return "done";
  }
  return startSimulation(run, repo, inst, brief.data);
}

async function startSimulation(run: Run, repo: Repo, inst: Installation, brief: ChangeBrief): Promise<StepResult> {
  const db = await getDb();
  if (!repo.audienceId) return "done";

  const [owner] = await db.select({ ownerId: githubInstallations.ownerId }).from(githubInstallations).where(eq(githubInstallations.id, inst.id));
  const people = await db
    .select({ id: personas.id, segmentKey: personas.segmentKey, ordinal: personas.ordinal })
    .from(personas)
    .where(eq(personas.audienceId, repo.audienceId));
  if (!people.length) {
    await stop(run, repo, inst, "skipped", "The connected audience has no personas.");
    return "done";
  }

  const experimentId = run.experimentId ?? (await createExperiment(run, repo, owner!.ownerId!));
  // `planAnchors` returns "all" for small audiences; the job handles both forms.
  const anchorIds = planAnchors(people, run.prNumber);

  const { jobId } = await enqueueSimulationForContent({
    ownerId: owner!.ownerId!,
    experimentId,
    audienceId: repo.audienceId,
    ideaId: repo.ideaId,
    content: contentFromBrief(brief, run, repo),
    anchorIds,
    personaTotal: people.length,
  });

  await db.update(githubPrRuns).set({ status: "simulating", experimentId, updatedAt: new Date() }).where(eq(githubPrRuns.id, run.id));
  await ensureSimulationJobRunning(jobId);
  return "continue";
}

function contentFromBrief(brief: ChangeBrief, run: Run, repo: Repo) {
  return {
    summary: brief.featureSummary,
    valueProposition: brief.customerFacingChange,
    // The brief describes a change, not a feature list; leaving this empty stops the simulation
    // prompt from treating open concerns as things being shipped.
    keyFeatures: [],
    pricingSummary: "",
    listedPrice: null,
    currency: "USD",
    adHeadline: run.prTitle.slice(0, 120),
    adCopy: `Pull request #${run.prNumber} in ${repo.fullName}. ${brief.customerFacingChange}`,
  };
}

async function stepSimulating(run: Run, repo: Repo, inst: Installation): Promise<StepResult> {
  if (!run.experimentId) return "done";
  const db = await getDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.experimentId, run.experimentId), eq(jobs.type, "simulate")))
    .limit(1);
  if (!job) return "done";

  if (job.status === "failed") {
    await stop(run, repo, inst, "failed", job.error ?? "The simulation failed.");
    return "done";
  }
  if (job.status === "cancelled") {
    await stop(run, repo, inst, "cancelled", "The simulation was cancelled.");
    return "done";
  }

  if (job.status === "queued" || job.status === "simulating") {
    await ensureSimulationJobRunning(job.id);
    const snap = await snapshotSimulationJob(job.id);
    if (!snap) return "done";
    if (snap.status === "complete" || snap.tally.stored >= snap.anchors) {
      await db.update(githubPrRuns).set({ status: "analyzing", updatedAt: new Date() }).where(eq(githubPrRuns.id, run.id));
      return "continue";
    }
    // Still working. Report back so the caller can wait a beat and try again.
    return "waiting";
  }

  await db.update(githubPrRuns).set({ status: "analyzing", updatedAt: new Date() }).where(eq(githubPrRuns.id, run.id));
  return "continue";
}

async function stepAnalyzing(run: Run, repo: Repo, inst: Installation): Promise<StepResult> {
  const db = await getDb();
  if (!run.experimentId) return "done";

  const rows = await loadCompactReactions(run.experimentId);
  if (!rows.length) {
    await stop(run, repo, inst, "failed", "No reactions were stored, so there is nothing to report.");
    return "done";
  }

  // The narrative is optional: numbers are already computed in code from stored reactions.
  const narrative = await loadNarrative(run.experimentId);
  const audience = repo.audienceId ? await loadAudienceRow(repo.audienceId) : null;
  const brief = changeBriefSchema.safeParse(run.brief);
  if (!brief.success) {
    await stop(run, repo, inst, "failed", "The change brief is missing.");
    return "done";
  }

  const stats = computeDashboard(rows);
  const input = {
    brief: brief.data,
    stats,
    narrative,
    audienceName: audience?.name ?? "Connected audience",
    audienceSize: audience?.size ?? stats.n,
    experimentHref: `${env().APP_URL}/experiments/${run.experimentId}/results`,
    simulated: env().MOCK_LLM,
    truncated: Boolean((run.brief as { truncated?: boolean } | null)?.truncated),
  };
  const body = renderComment(input);

  let commentId = run.commentId;
  if (repo.commentEnabled) {
    const posted = await upsertComment({
      installationId: inst.installationId,
      fullName: repo.fullName,
      prNumber: run.prNumber,
      body,
    });
    commentId = posted.id;
  }

  if (run.checkRunId) {
    await completeCheckRun({
      installationId: inst.installationId,
      fullName: repo.fullName,
      checkRunId: run.checkRunId,
      conclusion: "neutral",
      title: `Mean simulated interest ${stats.meanInterest ?? "—"}/100`,
      summary: renderCheckSummary(input),
    });
  }

  await db
    .update(githubPrRuns)
    .set({ status: "complete", narrative: narrative ?? null, commentBody: body, commentId, updatedAt: new Date() })
    .where(eq(githubPrRuns.id, run.id));
  return "done";
}

async function createExperiment(run: Run, repo: Repo, ownerId: string): Promise<string> {
  const db = await getDb();
  const [exp] = await db
    .insert(experiments)
    .values({
      ownerId,
      audienceId: repo.audienceId,
      ideaId: repo.ideaId,
      name: `${repo.fullName} #${run.prNumber}`,
      status: "simulating",
      seed: run.prNumber,
      changeSummary: run.prTitle.slice(0, 200),
    })
    .returning({ id: experiments.id });
  await db.update(githubPrRuns).set({ experimentId: exp!.id }).where(eq(githubPrRuns.id, run.id));
  return exp!.id;
}

/** PR touches nothing a customer would notice: say so on the check run, stay quiet on the thread. */
async function skipInternalOnly(run: Run, repo: Repo, inst: Installation, brief: ChangeBrief) {
  const db = await getDb();
  await db
    .update(githubPrRuns)
    .set({ status: "skipped", statusDetail: "No customer-visible change detected.", updatedAt: new Date() })
    .where(eq(githubPrRuns.id, run.id));
  if (run.checkRunId) {
    await completeCheckRun({
      installationId: inst.installationId,
      fullName: repo.fullName,
      checkRunId: run.checkRunId,
      conclusion: "success",
      title: "No customer-visible change",
      summary: renderSkippedSummary(brief),
    });
  }
  void repo;
}

/** Ends the run in a non-complete state and explains why on GitHub. */
async function stop(run: Run, repo: Repo, inst: Installation, status: "skipped" | "failed" | "cancelled", reason: string) {
  const db = await getDb();
  await db
    .update(githubPrRuns)
    .set({ status, statusDetail: reason, updatedAt: new Date() })
    .where(eq(githubPrRuns.id, run.id));

  if (status === "skipped" && repo.commentEnabled) {
    await commentNote({
      installationId: inst.installationId,
      fullName: repo.fullName,
      prNumber: run.prNumber,
      body:
        `**Simulated customer reaction — not run**\n\n${reason}\n\n` +
        `Set up an audience in Miro Fish, then re-run this review from the pull request.\n\n` +
        `_Simulated results are hypotheses, not user research._`,
    }).catch(() => undefined);
  }

  if (run.checkRunId) {
    await completeCheckRun({
      installationId: inst.installationId,
      fullName: repo.fullName,
      checkRunId: run.checkRunId,
      conclusion: status === "failed" ? "neutral" : "skipped",
      title: status === "skipped" ? "Simulated customer reaction — not run" : "Simulation could not finish",
      summary: reason,
    });
  }
}

async function hasPersonas(audienceId: string) {
  const db = await getDb();
  const rows = await db.select({ id: personas.id }).from(personas).where(eq(personas.audienceId, audienceId)).limit(1);
  return rows.length > 0;
}
