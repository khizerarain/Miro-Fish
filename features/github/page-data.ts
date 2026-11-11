import "server-only";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { githubConfig, installUrl } from "@/lib/github/app";
import { estimatePersonaJob, formatCost } from "@/features/audiences/cost";
import { EVERYONE_AUDIENCE_NAME, EVERYONE_AUDIENCE_SIZE } from "./everyone";
import { listAudiencesForUser, loadGithubWorkspace } from "./queries";

export type GithubSetupState =
  | { configured: false; reason: string }
  | { configured: true; installUrl: string; appSlug: string | null; webhookPath: string };

export async function loadGithubPage() {
  const user = await requireUser();
  const config = githubConfig();
  const [workspace, audiences] = await Promise.all([loadGithubWorkspace(user.id), listAudiencesForUser(user.id)]);

  const setup: GithubSetupState = config
    ? {
        configured: true,
        installUrl: installUrl(config),
        appSlug: config.slug,
        webhookPath: `${env().APP_URL}/api/github/webhook`,
      }
    : {
        configured: false,
        reason: missingEnvReason(),
      };

  return {
    setup,
    mockMode: env().MOCK_LLM,
    installations: workspace.installations.map((i) => ({
      id: i.id,
      accountLogin: i.accountLogin,
      accountType: i.accountType,
      suspended: Boolean(i.suspendedAt),
    })),
    repos: workspace.repos.map((r) => ({
      id: r.repo.id,
      fullName: r.repo.fullName,
      accountLogin: r.accountLogin,
      audienceId: r.repo.audienceId,
      audienceName: r.audienceName,
      commentEnabled: r.repo.commentEnabled,
      checkEnabled: r.repo.checkEnabled,
      runs: r.runs.map((run) => ({
        id: run.id,
        prNumber: run.prNumber,
        prTitle: run.prTitle,
        prUrl: run.prUrl,
        status: run.status,
        statusDetail: run.statusDetail,
        updatedAt: run.updatedAt.toISOString(),
        experimentId: run.experimentId,
      })),
    })),
    audiences: audiences.map((a) => ({ id: a.id, name: a.name, size: a.size, status: a.status })),
    everyone: everyoneOffer(audiences),
  };
}

function everyoneOffer(audiences: { name: string; status: string }[]) {
  const existing = audiences.find((a) => a.name === EVERYONE_AUDIENCE_NAME);
  const mock = env().MOCK_LLM;
  const estimate = estimatePersonaJob(EVERYONE_AUDIENCE_SIZE, mock);
  return {
    size: EVERYONE_AUDIENCE_SIZE,
    needsGeneration: !existing || existing.status === "draft" || existing.status === "failed",
    costLabel: formatCost(estimate.estimatedCostCents, mock),
  };
}

export type GithubPageData = Awaited<ReturnType<typeof loadGithubPage>>;

export function missingEnvReason() {
  const e = env();
  const missing: string[] = [];
  if (!e.GITHUB_APP_ID) missing.push("GITHUB_APP_ID");
  if (!e.GITHUB_APP_PRIVATE_KEY) missing.push("GITHUB_APP_PRIVATE_KEY");
  if (!e.GITHUB_WEBHOOK_SECRET) missing.push("GITHUB_WEBHOOK_SECRET");
  return missing.length ? `Set ${missing.join(", ")} in .env.local, then restart the server.` : "";
}
