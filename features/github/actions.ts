"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { audiences, githubInstallations, githubPrRuns, githubRepos } from "@/db/schema";
import { startPersonaGeneration } from "@/features/audiences/actions";
import { getOwnedAudience } from "@/features/audiences/queries";
import { requireUser } from "@/lib/auth";
import { EVERYONE_AUDIENCE_NAME, EVERYONE_AUDIENCE_SEED, EVERYONE_AUDIENCE_SIZE, EVERYONE_DEFINITION } from "./everyone";
import { advancePrRun } from "./pipeline";

type Fail = { ok: false; error: string };
type Ok<T = object> = { ok: true } & T;

const idSchema = z.uuid();

async function ownedRepo(userId: string, repoId: string) {
  if (!idSchema.safeParse(repoId).success) return null;
  const db = await getDb();
  const [row] = await db
    .select({ repo: githubRepos, ownerId: githubInstallations.ownerId })
    .from(githubRepos)
    .innerJoin(githubInstallations, eq(githubInstallations.id, githubRepos.installationId))
    .where(eq(githubRepos.id, repoId))
    .limit(1);
  if (!row || row.ownerId !== userId) return null;
  return row.repo;
}

export async function setRepoAudience(repoId: string, audienceId: string | null): Promise<Ok | Fail> {
  const user = await requireUser();
  const repo = await ownedRepo(user.id, repoId);
  if (!repo) return { ok: false, error: "That repository is not connected to your account." };
  if (audienceId) {
    const audience = await getOwnedAudience(user.id, audienceId);
    if (!audience || audience.isTemplate) return { ok: false, error: "Unknown audience." };
  }

  const db = await getDb();
  await db
    .update(githubRepos)
    .set({ audienceId: audienceId ?? null, updatedAt: new Date() })
    .where(eq(githubRepos.id, repo.id));
  revalidatePath("/github");
  return { ok: true };
}

/**
 * Connects the repo to the user's broad "Everyone" audience, creating it and starting persona
 * generation the first time. Reused across repos so they all review with the same people.
 */
export async function connectEveryoneAudience(repoId: string): Promise<Ok<{ generating: boolean }> | Fail> {
  const user = await requireUser();
  const repo = await ownedRepo(user.id, repoId);
  if (!repo) return { ok: false, error: "That repository is not connected to your account." };

  const db = await getDb();
  let [audience] = await db
    .select()
    .from(audiences)
    .where(
      and(
        eq(audiences.ownerId, user.id),
        eq(audiences.name, EVERYONE_AUDIENCE_NAME),
        eq(audiences.isTemplate, false),
      ),
    )
    .limit(1);
  if (!audience) {
    [audience] = await db
      .insert(audiences)
      .values({
        ownerId: user.id,
        name: EVERYONE_AUDIENCE_NAME,
        definition: EVERYONE_DEFINITION,
        size: EVERYONE_AUDIENCE_SIZE,
        seed: EVERYONE_AUDIENCE_SEED,
        status: "draft",
      })
      .returning();
  }

  await db
    .update(githubRepos)
    .set({ audienceId: audience!.id, updatedAt: new Date() })
    .where(eq(githubRepos.id, repo.id));

  let generating = audience!.status === "generating";
  if (audience!.status === "draft" || audience!.status === "failed") {
    const started = await startPersonaGeneration(audience!.id);
    if (!started.ok) return started;
    generating = true;
  }
  revalidatePath("/github");
  return { ok: true, generating };
}

export async function setRepoToggles(
  repoId: string,
  toggles: { commentEnabled?: boolean; checkEnabled?: boolean },
): Promise<Ok | Fail> {
  const user = await requireUser();
  const repo = await ownedRepo(user.id, repoId);
  if (!repo) return { ok: false, error: "That repository is not connected to your account." };
  const db = await getDb();
  await db
    .update(githubRepos)
    .set({
      commentEnabled: toggles.commentEnabled ?? repo.commentEnabled,
      checkEnabled: toggles.checkEnabled ?? repo.checkEnabled,
      updatedAt: new Date(),
    })
    .where(eq(githubRepos.id, repo.id));
  revalidatePath("/github");
  return { ok: true };
}

export async function disconnectRepo(repoId: string): Promise<Ok | Fail> {
  const user = await requireUser();
  const repo = await ownedRepo(user.id, repoId);
  if (!repo) return { ok: false, error: "That repository is not connected to your account." };
  const db = await getDb();
  await db.delete(githubRepos).where(eq(githubRepos.id, repo.id));
  revalidatePath("/github");
  return { ok: true };
}

/** Re-runs a PR review from scratch (new brief, new simulation). */
export async function retryPrRun(runId: string): Promise<Ok<{ runId: string }> | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(runId).success) return { ok: false, error: "Unknown review." };
  const db = await getDb();
  const [row] = await db
    .select({ run: githubPrRuns, ownerId: githubInstallations.ownerId })
    .from(githubPrRuns)
    .innerJoin(githubRepos, eq(githubRepos.id, githubPrRuns.repoId))
    .innerJoin(githubInstallations, eq(githubInstallations.id, githubRepos.installationId))
    .where(eq(githubPrRuns.id, runId))
    .limit(1);
  if (!row || row.ownerId !== user.id) return { ok: false, error: "That review is not on a repository you connected." };

  await db
    .update(githubPrRuns)
    .set({
      status: "queued",
      statusDetail: null,
      brief: null,
      narrative: null,
      commentBody: null,
      experimentId: null,
      updatedAt: new Date(),
    })
    .where(eq(githubPrRuns.id, runId));

  void advancePrRun(runId);
  revalidatePath("/github");
  return { ok: true, runId };
}

/** Advances a run that is waiting on a simulation. Called by the settings page poller. */
export async function pollPrRun(runId: string): Promise<Ok<{ status: string; detail: string | null }> | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(runId).success) return { ok: false, error: "Unknown review." };
  const db = await getDb();
  const [row] = await db
    .select({ run: githubPrRuns, ownerId: githubInstallations.ownerId })
    .from(githubPrRuns)
    .innerJoin(githubRepos, eq(githubRepos.id, githubPrRuns.repoId))
    .innerJoin(githubInstallations, eq(githubInstallations.id, githubRepos.installationId))
    .where(and(eq(githubPrRuns.id, runId), eq(githubInstallations.ownerId, user.id)))
    .limit(1);
  if (!row) return { ok: false, error: "That review is not on a repository you connected." };

  if (row.run.status === "queued" || row.run.status === "briefing" || row.run.status === "simulating" || row.run.status === "analyzing") {
    await advancePrRun(runId);
  }
  const [fresh] = await db.select().from(githubPrRuns).where(eq(githubPrRuns.id, runId)).limit(1);
  return { ok: true, status: fresh?.status ?? row.run.status, detail: fresh?.statusDetail ?? null };
}
