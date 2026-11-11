import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { audiences, githubInstallations, githubPrRuns, githubRepos, users } from "@/db/schema";
import type { ChangeBrief } from "./brief";

export async function loadAudienceRow(audienceId: string) {
  const db = await getDb();
  const [row] = await db.select().from(audiences).where(eq(audiences.id, audienceId)).limit(1);
  return row ?? null;
}

export async function getInstallationByGithubId(installationId: number) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId))
    .limit(1);
  return row ?? null;
}

export async function getRepoByGithubId(repositoryId: number) {
  const db = await getDb();
  const [row] = await db.select().from(githubRepos).where(eq(githubRepos.repositoryId, repositoryId)).limit(1);
  return row ?? null;
}

export async function getPrRun(repoId: string, prNumber: number) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(githubPrRuns)
    .where(and(eq(githubPrRuns.repoId, repoId), eq(githubPrRuns.prNumber, prNumber)))
    .limit(1);
  return row ?? null;
}

export async function getPrRunForUser(userId: string, runId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      run: githubPrRuns,
      repo: githubRepos,
      installedBy: githubInstallations.ownerId,
      accountLogin: githubInstallations.accountLogin,
    })
    .from(githubPrRuns)
    .innerJoin(githubRepos, eq(githubRepos.id, githubPrRuns.repoId))
    .innerJoin(githubInstallations, eq(githubInstallations.id, githubRepos.installationId))
    .where(eq(githubPrRuns.id, runId))
    .limit(1);
  if (!row) return null;

  // Visible to the person who installed the app, or to any member of the connected account.
  const db2 = await getDb();
  const [member] = await db2
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!member) return null;

  const isInstaller = row.installedBy === userId;
  const isOwnerOfAudience = row.repo.audienceId
    ? Boolean(
        (
          await db2
            .select({ id: audiences.id })
            .from(audiences)
            .where(and(eq(audiences.id, row.repo.audienceId), eq(audiences.ownerId, userId)))
            .limit(1)
        )[0],
      )
    : false;
  if (!isInstaller && !isOwnerOfAudience) return null;

  return row;
}

export async function listInstallationsForUser(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.ownerId, userId))
    .orderBy(desc(githubInstallations.createdAt));
}

export async function listReposForInstallations(installationIds: string[]) {
  if (!installationIds.length) return [];
  const db = await getDb();
  const rows = await db.select().from(githubRepos);
  return rows.filter((r) => installationIds.includes(r.installationId));
}

export type RepoWithRuns = {
  repo: typeof githubRepos.$inferSelect;
  accountLogin: string;
  audienceName: string | null;
  runs: Pick<
    typeof githubPrRuns.$inferSelect,
    "id" | "prNumber" | "prTitle" | "status" | "statusDetail" | "updatedAt" | "createdAt" | "prUrl" | "experimentId"
  >[];
};

/** Everything the settings page needs: connected repos, their audience, and recent PR reviews. */
export async function loadGithubWorkspace(userId: string) {
  const installations = await listInstallationsForUser(userId);
  if (!installations.length) return { installations: [], repos: [] as RepoWithRuns[] };

  const db = await getDb();
  const repos = await listReposForInstallations(installations.map((i) => i.id));
  const audienceIds = repos.map((r) => r.audienceId).filter((v): v is string => Boolean(v));
  const audienceRows = audienceIds.length
    ? (await db.select({ id: audiences.id, name: audiences.name, size: audiences.size }).from(audiences)).filter((a) =>
        audienceIds.includes(a.id),
      )
    : [];
  const audienceById = new Map(audienceRows.map((a) => [a.id, a]));
  const loginByInstallation = new Map(installations.map((i) => [i.id, i.accountLogin]));

  const allRuns = repos.length
    ? (await db.select().from(githubPrRuns).orderBy(desc(githubPrRuns.createdAt))).filter((r) =>
        repos.some((repo) => repo.id === r.repoId),
      )
    : [];

  const out: RepoWithRuns[] = repos.map((repo) => ({
    repo,
    accountLogin: loginByInstallation.get(repo.installationId) ?? "",
    audienceName: repo.audienceId ? (audienceById.get(repo.audienceId)?.name ?? "Missing audience") : null,
    runs: allRuns
      .filter((r) => r.repoId === repo.id)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        prNumber: r.prNumber,
        prTitle: r.prTitle,
        status: r.status,
        statusDetail: r.statusDetail,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        prUrl: r.prUrl,
        experimentId: r.experimentId,
      })),
  }));

  return { installations, repos: out };
}

export async function listAudiencesForUser(userId: string) {
  const db = await getDb();
  return db
    .select({ id: audiences.id, name: audiences.name, size: audiences.size, status: audiences.status })
    .from(audiences)
    .where(and(eq(audiences.ownerId, userId), eq(audiences.isTemplate, false)))
    .orderBy(desc(audiences.updatedAt));
}

export function briefOf(run: { brief: unknown }): ChangeBrief | null {
  const b = run.brief as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  return b as unknown as ChangeBrief;
}
