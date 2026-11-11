import "server-only";
import { githubApi } from "@/lib/github/app";
import { COMMENT_MARKER } from "./comment";

export type PostedComment = { id: number; htmlUrl: string | null };

type IssueComment = { id: number; html_url?: string; body?: string };

/**
 * Creates the comment, or updates the existing one carrying our marker.
 * Idempotent so a retried job cannot stack duplicate comments on the same PR.
 */
export async function upsertComment(opts: {
  installationId: number;
  fullName: string;
  prNumber: number;
  body: string;
}): Promise<PostedComment> {
  const path = `/repos/${opts.fullName}/issues/${opts.prNumber}/comments`;

  const existing = await findOurComment(opts.installationId, opts.fullName, opts.prNumber);
  if (existing) {
    const updated = await githubApi<IssueComment>(opts.installationId, `${path}/${existing.id}`, {
      method: "PATCH",
      body: { body: opts.body },
    });
    return { id: updated.id, htmlUrl: updated.html_url ?? null };
  }

  const created = await githubApi<IssueComment>(opts.installationId, path, {
    method: "POST",
    body: { body: opts.body },
  });
  return { id: created.id, htmlUrl: created.html_url ?? null };
}

async function findOurComment(installationId: number, fullName: string, prNumber: number): Promise<IssueComment | null> {
  for (let page = 1; page <= 3; page++) {
    const batch = await githubApi<IssueComment[]>(
      installationId,
      `/repos/${fullName}/issues/${prNumber}/comments?per_page=100&page=${page}`,
    );
    const hit = batch.find((c) => c.body?.includes(COMMENT_MARKER));
    if (hit) return hit;
    if (batch.length < 100) return null;
  }
  return null;
}

export type CheckRun = { id: number };

/** Starts a check run in progress. Returns null when the App lacks checks:write. */
export async function startCheckRun(opts: {
  installationId: number;
  fullName: string;
  headSha: string;
  title: string;
}): Promise<CheckRun | null> {
  try {
    return await githubApi<{ id: number }>(opts.installationId, `/repos/${opts.fullName}/check-runs`, {
      method: "POST",
      body: {
        name: "Simulated customer reaction",
        head_sha: opts.headSha,
        status: "in_progress",
        started_at: new Date().toISOString(),
        output: { title: "Simulating customer reactions", summary: opts.title },
      },
    });
  } catch {
    return null; // the token may not include checks:write; the comment still works
  }
}

export type CheckConclusion = "success" | "neutral" | "failure" | "skipped" | "cancelled";

/**
 * Completes the check run. `neutral` is the normal conclusion: this check reports a hypothesis
 * and never blocks a merge.
 */
export async function completeCheckRun(opts: {
  installationId: number;
  fullName: string;
  checkRunId: number;
  conclusion: CheckConclusion;
  title: string;
  summary: string;
}): Promise<void> {
  try {
    await githubApi(opts.installationId, `/repos/${opts.fullName}/check-runs/${opts.checkRunId}`, {
      method: "PATCH",
      body: {
        status: "completed",
        conclusion: opts.conclusion,
        completed_at: new Date().toISOString(),
        output: { title: opts.title, summary: opts.summary },
      },
    });
  } catch {
    // A stale or deleted check run is not worth failing the job over.
  }
}

/** Posts a plain note on the PR, e.g. "connect an audience before I can review this". */
export async function commentNote(opts: {
  installationId: number;
  fullName: string;
  prNumber: number;
  body: string;
}): Promise<void> {
  await githubApi(opts.installationId, `/repos/${opts.fullName}/issues/${opts.prNumber}/comments`, {
    method: "POST",
    body: { body: opts.body },
  });
}
