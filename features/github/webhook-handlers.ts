import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { githubDeliveries, githubInstallations, githubPrRuns, githubRepos } from "@/db/schema";
import { githubApi } from "@/lib/github/app";
import { REVIEWABLE_ACTIONS, type InstallationEvent, type InstallationRepositoriesEvent, type PullRequestEvent } from "@/lib/github/webhooks";
import { getInstallationByGithubId, getPrRun, getRepoByGithubId } from "./queries";

/** Records a delivery. Returns false when we have already handled it (GitHub redelivers on failure). */
export async function recordDelivery(input: {
  deliveryId: string;
  event: string;
  action: string | null;
  subject: string | null;
}): Promise<boolean> {
  const db = await getDb();
  const inserted = await db
    .insert(githubDeliveries)
    .values(input)
    .onConflictDoNothing({ target: githubDeliveries.deliveryId })
    .returning({ id: githubDeliveries.id });
  return inserted.length > 0;
}

export async function handleInstallation(payload: InstallationEvent) {
  const db = await getDb();
  const existing = await getInstallationByGithubId(payload.installation.id);

  if (payload.action === "deleted") {
    if (existing) await db.delete(githubInstallations).where(eq(githubInstallations.id, existing.id));
    return;
  }
  if (payload.action === "suspend" || payload.action === "unsuspend") {
    if (existing) {
      await db
        .update(githubInstallations)
        .set({ suspendedAt: payload.action === "suspend" ? new Date() : null, updatedAt: new Date() })
        .where(eq(githubInstallations.id, existing.id));
    }
    return;
  }

  const values = {
    installationId: payload.installation.id,
    accountLogin: payload.installation.account.login,
    accountType: payload.installation.account.type,
    accountId: payload.installation.account.id,
    suspendedAt: payload.installation.suspended_at ? new Date(payload.installation.suspended_at) : null,
    updatedAt: new Date(),
  };

  const installRow = existing
    ? (await db.update(githubInstallations).set(values).where(eq(githubInstallations.id, existing.id)).returning())[0]!
    : (await db.insert(githubInstallations).values(values).returning())[0]!;

  // `installation.created` carries only the repositories selected at install time.
  for (const repo of payload.repositories ?? []) {
    await upsertRepo(installRow.id, repo);
  }
  // Belt and braces: list everything the installation can see, so "all repositories" installs
  // and later additions are both captured without waiting for another webhook.
  await syncInstallationRepos(installRow.id, payload.installation.id);
}

export async function handleInstallationRepositories(payload: InstallationRepositoriesEvent) {
  const db = await getDb();
  const installation = await getInstallationByGithubId(payload.installation.id);
  if (!installation) {
    // We missed the install event (e.g. server was down). Create the row so the app still works.
    await handleInstallation({ action: "created", installation: payload.installation, repositories: [] } as InstallationEvent);
    return;
  }
  for (const repo of payload.repositories_added) await upsertRepo(installation.id, repo);
  const removedIds = payload.repositories_removed.map((r) => r.id);
  for (const repositoryId of removedIds) {
    const row = await getRepoByGithubId(repositoryId);
    if (row) await db.delete(githubRepos).where(eq(githubRepos.id, row.id));
  }
}

async function upsertRepo(
  installationRowId: string,
  repo: { id: number; full_name: string; default_branch?: string | null },
) {
  const db = await getDb();
  const existing = await getRepoByGithubId(repo.id);
  if (existing) {
    await db
      .update(githubRepos)
      .set({ fullName: repo.full_name, defaultBranch: repo.default_branch ?? existing.defaultBranch, updatedAt: new Date() })
      .where(eq(githubRepos.id, existing.id));
    return;
  }
  await db.insert(githubRepos).values({
    installationId: installationRowId,
    repositoryId: repo.id,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch ?? null,
  });
}

/** Pulls the authoritative repo list for an installation. Failures are non-fatal. */
export async function syncInstallationRepos(installationRowId: string, githubInstallationId: number) {
  try {
    const page = await githubApi<{ repositories: { id: number; full_name: string; default_branch: string }[] }>(
      githubInstallationId,
      "/installation/repositories?per_page=100",
    );
    for (const repo of page.repositories) await upsertRepo(installationRowId, repo);
    const db = await getDb();
    await db.update(githubInstallations).set({ updatedAt: new Date() }).where(eq(githubInstallations.id, installationRowId));
  } catch (err) {
    console.warn(JSON.stringify({ evt: "github", step: "sync_repos", ok: false, error: (err as Error).message }));
  }
}

export async function linkInstallationToUser(githubInstallationId: number, userId: string) {
  const db = await getDb();
  const row = await getInstallationByGithubId(githubInstallationId);
  if (!row) return false;
  await db.update(githubInstallations).set({ ownerId: userId, updatedAt: new Date() }).where(eq(githubInstallations.id, row.id));
  return true;
}

export type PrEnqueued = { runId: string; created: boolean; ignored: string | null };

/**
 * Creates or resets the review for a PR. A `synchronize` event (new commits) reuses the same row and
 * clears the previous brief/narrative so the review reflects the new head commit.
 */
export async function enqueuePullRequest(payload: PullRequestEvent): Promise<PrEnqueued> {
  const db = await getDb();
  if (!payload.installation) return { runId: "", created: false, ignored: "Delivery has no installation." };
  if (!REVIEWABLE_ACTIONS.has(payload.action)) {
    return { runId: "", created: false, ignored: `Action "${payload.action}" does not change the review.` };
  }
  if (payload.pull_request.draft) return { runId: "", created: false, ignored: "Draft pull requests are reviewed when marked ready." };
  if (payload.pull_request.merged) return { runId: "", created: false, ignored: "Merged pull requests are not reviewed." };

  const installation = await getInstallationByGithubId(payload.installation.id);
  if (!installation) return { runId: "", created: false, ignored: "Installation is not known to Miro Fish." };
  if (installation.suspendedAt) return { runId: "", created: false, ignored: "Installation is suspended." };

  const repo = await getRepoByGithubId(payload.repository.id);
  if (!repo) return { runId: "", created: false, ignored: "Repository is not connected." };
  if (!repo.audienceId) {
    return { runId: "", created: false, ignored: "Repository has no audience connected." };
  }

  const pr = payload.pull_request;
  const existing = await getPrRun(repo.id, pr.number);

  if (existing) {
    // New commits on the same PR: restart the review against the new head.
    const [updated] = await db
      .update(githubPrRuns)
      .set({
        status: "queued",
        statusDetail: null,
        prTitle: pr.title,
        prBody: pr.body ?? null,
        prUrl: pr.html_url,
        headSha: pr.head?.sha ?? null,
        authorLogin: pr.user?.login ?? null,
        brief: null,
        narrative: null,
        commentBody: null,
        checkRunId: null,
        // A new commit means a new experiment; keep the old one reachable from the history.
        experimentId: null,
        additions: pr.additions ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(githubPrRuns.id, existing.id))
      .returning({ id: githubPrRuns.id });

    return { runId: updated!.id, created: false, ignored: null };
  }

  const [created] = await db
    .insert(githubPrRuns)
    .values({
      repoId: repo.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prBody: pr.body ?? null,
      prUrl: pr.html_url,
      headSha: pr.head?.sha ?? null,
      authorLogin: pr.user?.login ?? null,
      status: "queued",
      filesChanged: pr.changed_files ?? 0,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
    })
    .returning({ id: githubPrRuns.id });

  return { runId: created!.id, created: true, ignored: null };
}
