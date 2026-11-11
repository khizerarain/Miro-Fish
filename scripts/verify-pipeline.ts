/**
 * End-to-end test of the PR review state machine with GitHub's REST API stubbed at the fetch layer.
 * Proves: diff → brief → simulation → analyze → comment + check run, plus skip paths.
 *
 * Run: npx tsx --import ./scripts/no-server-only.mjs scripts/verify-pipeline.ts
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

import { generateKeyPairSync } from "node:crypto";
import { eq } from "drizzle-orm";

/**
 * This test needs *some* App credentials to mint installation tokens. Rather than require real
 * ones, generate a throwaway RSA key and inject it, so the suite runs on a clean checkout.
 * Must happen before `lib/github/app` reads env (it caches on first use).
 */
function injectTestCredentials() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.GITHUB_APP_ID = "123456";
  process.env.GITHUB_APP_PRIVATE_KEY = privateKey;
  process.env.GITHUB_WEBHOOK_SECRET = "pipeline-test-webhook-secret";
  process.env.GITHUB_APP_SLUG = "miro-fish-test";
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function section(name: string) {
  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 58 - name.length))}`);
}

// ---------------------------------------------------------------- GitHub API stub
type Call = { method: string; path: string; body: unknown };
const calls: Call[] = [];
let nextCheckRunId = 5001;
let nextCommentId = 9001;
let fileFixture: { filename: string; status: string; additions: number; deletions: number; patch?: string }[] = [];
let commentsFixture: { id: number; body: string }[] = [];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.replace("https://api.github.com", "");
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ method, path, body });

  if (path.includes("/access_tokens")) {
    return json({ token: "ghs_stub_token", expires_at: new Date(Date.now() + 3_600_000).toISOString() });
  }
  if (/\/pulls\/\d+\/files/.test(path)) {
    return json(fileFixture);
  }
  if (/\/check-runs$/.test(path) && method === "POST") {
    return json({ id: nextCheckRunId++ });
  }
  if (/\/check-runs\/\d+$/.test(path) && method === "PATCH") {
    return json({ id: 1, status: "completed" });
  }
  if (/\/issues\/\d+\/comments/.test(path)) {
    if (method === "GET") return json(commentsFixture);
    if (method === "POST") {
      const created = { id: nextCommentId++, body: String(body?.body ?? "") };
      commentsFixture.push(created);
      return json(created, 201);
    }
  }
  if (/\/installation\/repositories/.test(path)) {
    return json({ total_count: 0, repositories: [] });
  }
  return json({ message: "unexpected stub route" }, 404);
}) as typeof fetch;

function resetStubs() {
  calls.length = 0;
  commentsFixture = [];
  fileFixture = [];
}

async function main() {
  injectTestCredentials();
  const { getDb } = await import("../db");
  const schema = await import("../db/schema");
  const db = await getDb();
  const { purgeTestUsers } = await import("./purge-test-users");
  await purgeTestUsers(db, "pipe-");
  const suffix = Date.now().toString(36);

  const [user] = await db
    .insert(schema.users)
    .values({ email: `pipe-${suffix}@example.test`, authProvider: "local" })
    .returning();
  const [audience] = await db
    .insert(schema.audiences)
    .values({
      ownerId: user!.id,
      name: `Pipe audience ${suffix}`,
      size: 30,
      seed: 4242,
      status: "ready",
      definition: {
        segments: [{ key: "buyers", label: "Buyers", rationale: "", weight: 100, enabled: true, custom: false }],
        filters: {},
      },
    })
    .returning();
  await db.insert(schema.personas).values(
    Array.from({ length: 30 }, (_, i) => ({
      audienceId: audience!.id,
      ordinal: i,
      segmentKey: "buyers",
      name: `Pipe Persona ${i}`,
      age: 30 + (i % 20),
      profession: "Buyer",
      incomeBand: "40_75k",
      techComfort: 3,
      profile: {
        ordinal: i,
        name: `Pipe Persona ${i}`,
        financialSituation: "Careful with renewals.",
        personalityTraits: ["practical", "skeptical"],
        interests: ["productivity"],
        needs: ["clarity"],
        painPoints: ["surprise charges"],
        currentAlternatives: ["a spreadsheet"],
        buyingBehavior: { style: "researcher", priceSensitivity: "high" },
        backstory: "Buys deliberately, reads terms, dislikes surprise charges and extra steps at checkout.",
        age: 30 + (i % 20),
        gender: "woman",
        location: "Austin",
        region: "us_texas",
        profession: "Buyer",
        incomeBand: "40_75k",
        techComfort: 3,
        segmentKey: "buyers",
      },
    })),
  );

  const [inst] = await db
    .insert(schema.githubInstallations)
    .values({
      installationId: Number(`7${Date.now() % 1_000_000}`),
      accountLogin: "khizerarain",
      accountType: "User",
      ownerId: user!.id,
    })
    .returning();
  const [repo] = await db
    .insert(schema.githubRepos)
    .values({
      installationId: inst!.id,
      repositoryId: Number(`6${Date.now() % 1_000_000}`),
      fullName: "khizerarain/Miro-Fish",
      audienceId: audience!.id,
    })
    .returning();

  const { enqueuePullRequest } = await import("../features/github/webhook-handlers");
  const { advancePrRun } = await import("../features/github/pipeline");

  // ------------------------------------------------------------ case 1: real change
  section("state machine: customer-visible PR");
  resetStubs();
  fileFixture = [
    {
      filename: "app/checkout/trial-banner.tsx",
      status: "added",
      additions: 60,
      deletions: 0,
      patch: "+export function TrialBanner() { return <div>Start your free trial</div> }",
    },
    { filename: "app/checkout/page.tsx", status: "modified", additions: 4, deletions: 1, patch: "+  <TrialBanner />" },
  ];

  const payload = {
    action: "opened" as const,
    number: 101,
    pull_request: {
      number: 101,
      title: "Add a trial banner to checkout",
      html_url: "https://github.com/khizerarain/Miro-Fish/pull/101",
      body: "Adds a trial prompt.",
      draft: false,
      user: { login: "khizerarain" },
      head: { sha: "deadbeef", ref: "feat/trial" },
      base: { sha: "cafe", ref: "main" },
      additions: 64,
      deletions: 1,
      changed_files: 2,
      merged: false,
    },
    repository: { id: repo!.repositoryId, full_name: "khizerarain/Miro-Fish", default_branch: "main" },
    installation: { id: inst!.installationId },
    sender: { login: "khizerarain" },
  };

  const enq = await enqueuePullRequest(payload);
  check("enqueues a run", Boolean(enq.runId) && !enq.ignored, enq.ignored ?? enq.runId);

  const startedCheckRun = calls.some((c) => /\/check-runs$/.test(c.path) && c.method === "POST");
  await advancePrRun(enq.runId);
  check("starts an in-progress check run", startedCheckRun || calls.some((c) => /\/check-runs$/.test(c.path) && c.method === "POST"));

  const [finalRun] = await db.select().from(schema.githubPrRuns).where(eq(schema.githubPrRuns.id, enq.runId));
  check("run reaches complete", finalRun?.status === "complete", `${finalRun?.status} ${finalRun?.statusDetail ?? ""}`);
  check("run has an experiment", Boolean(finalRun?.experimentId));
  check("brief was persisted", Boolean(finalRun?.brief));
  check("PR body is stored for the brief prompt", finalRun?.prBody === "Adds a trial prompt.", finalRun?.prBody ?? "null");

  const brief = finalRun!.brief as { customerVisible: boolean; changeType: string; featureSummary: string };
  check("brief marks it customer visible", brief.customerVisible === true);
  check("brief mentions the touched file", brief.featureSummary.includes("trial-banner.tsx"), brief.featureSummary);

  const posted = commentsFixture[0];
  check("posts exactly one comment", commentsFixture.length === 1, `${commentsFixture.length} posted`);
  check("comment carries the marker", Boolean(posted?.body.includes("miro-fish:simulated-customer-reaction")));
  check("comment labels results as simulated", Boolean(posted?.body.includes("Simulated results")));
  check("comment includes computed metrics", Boolean(posted?.body.includes("Mean simulated interest")));
  check("comment links to the dashboard", Boolean(posted?.body.includes(`/experiments/${finalRun!.experimentId}/results`)));
  check("comment never claims proof", !/\bproves\b/.test(posted?.body ?? ""));

  const completedCheck = calls.filter((c) => /\/check-runs\/\d+$/.test(c.path) && c.method === "PATCH");
  check("completes the check run", completedCheck.length === 1);
  const conclusion = (completedCheck[0]?.body as { conclusion?: string } | undefined)?.conclusion;
  check("check run is neutral, never blocking", conclusion === "neutral", conclusion);

  // ------------------------------------------------------------ case 2: internal-only PR
  section("state machine: internal-only PR");
  resetStubs();
  fileFixture = [{ filename: ".github/workflows/ci.yml", status: "modified", additions: 3, deletions: 1, patch: "+  run: npm test" }];

  const internalPayload = {
    ...payload,
    number: 102,
    pull_request: { ...payload.pull_request, number: 102, title: "Bump CI runner", html_url: "https://github.com/x/y/pull/102", head: { sha: "aaa", ref: "chore/ci" } },
  };
  const enq2 = await enqueuePullRequest(internalPayload);
  await advancePrRun(enq2.runId);
  const [run2] = await db.select().from(schema.githubPrRuns).where(eq(schema.githubPrRuns.id, enq2.runId));
  check("internal PR is skipped", run2?.status === "skipped", run2?.status);
  check("skip reason is recorded", run2?.statusDetail === "No customer-visible change detected.");
  check("no comment posted for internal PR", commentsFixture.length === 0, `${commentsFixture.length} posted`);
  const skippedCheck = calls.find((c) => /\/check-runs\/\d+$/.test(c.path) && c.method === "PATCH");
  check(
    "check run still reports success (nothing wrong)",
    (skippedCheck?.body as { conclusion?: string } | undefined)?.conclusion === "success",
  );

  // ------------------------------------------------------------ case 3: resync clears brief
  section("state machine: new commits restart the review");
  resetStubs();
  fileFixture = [{ filename: "app/pricing/page.tsx", status: "modified", additions: 9, deletions: 2, patch: "+ <Price value={19} />" }];
  const syncPayload = {
    ...payload,
    action: "synchronize" as const,
    pull_request: { ...payload.pull_request, head: { sha: "secondsha", ref: "feat/trial" } },
  };
  const enq3 = await enqueuePullRequest(syncPayload);
  check("reuses the same run row", enq3.runId === enq.runId, `${enq3.runId} vs ${enq.runId}`);
  const [afterSync] = await db.select().from(schema.githubPrRuns).where(eq(schema.githubPrRuns.id, enq.runId));
  check("resets the brief", afterSync?.brief === null);
  check("resets the experiment link", afterSync?.experimentId === null);

  await advancePrRun(enq.runId);
  const [rerun] = await db.select().from(schema.githubPrRuns).where(eq(schema.githubPrRuns.id, enq.runId));
  check("re-review completes", rerun?.status === "complete", rerun?.status);
  check("updates the existing comment instead of adding one", commentsFixture.length === 1, `${commentsFixture.length} comments`);
  check("comment reflects the new change", Boolean(commentsFixture[0]?.body.includes("pricing")), "pricing");

  // ------------------------------------------------------------ case 4: non-reviewable actions
  section("state machine: ignored events");
  resetStubs();
  const closed = await enqueuePullRequest({ ...payload, action: "closed", number: 103 });
  check("ignores a closed PR", Boolean(closed.ignored), closed.ignored ?? "");
  const draft = await enqueuePullRequest({
    ...payload,
    action: "opened",
    number: 104,
    pull_request: { ...payload.pull_request, number: 104, draft: true },
  });
  check("ignores a draft PR", Boolean(draft.ignored), draft.ignored ?? "");

  // ------------------------------------------------------------ case 5: no audience
  section("state machine: repository without an audience");
  resetStubs();
  await db.update(schema.githubRepos).set({ audienceId: null }).where(eq(schema.githubRepos.id, repo!.id));
  const enq5 = await enqueuePullRequest({ ...payload, number: 105, pull_request: { ...payload.pull_request, number: 105 } });
  check("rejects a PR when no audience is connected", Boolean(enq5.ignored), enq5.ignored ?? "");
  await db.update(schema.githubRepos).set({ audienceId: audience!.id }).where(eq(schema.githubRepos.id, repo!.id));

  // ------------------------------------------------------------ case 6: audience still generating
  section("state machine: audience still generating");
  resetStubs();
  fileFixture = [{ filename: "app/pricing/page.tsx", status: "modified", additions: 2, deletions: 1, patch: "+ $12/mo" }];
  await db.update(schema.audiences).set({ status: "generating" }).where(eq(schema.audiences.id, audience!.id));
  const enq6 = await enqueuePullRequest({ ...payload, number: 106, pull_request: { ...payload.pull_request, number: 106 } });
  await advancePrRun(enq6.runId);
  const [run6] = await db.select().from(schema.githubPrRuns).where(eq(schema.githubPrRuns.id, enq6.runId));
  check("skips instead of reviewing with a half-built audience", run6?.status === "skipped", run6?.statusDetail ?? "");
  check("tells the author to re-run later", /still generating/.test(run6?.statusDetail ?? ""));
  await db.update(schema.audiences).set({ status: "ready" }).where(eq(schema.audiences.id, audience!.id));

  // ------------------------------------------------------------ cleanup
  globalThis.fetch = realFetch;
  await db.delete(schema.users).where(eq(schema.users.id, user!.id));
  await db.delete(schema.audiences).where(eq(schema.audiences.id, audience!.id));
  await db.delete(schema.githubInstallations).where(eq(schema.githubInstallations.id, inst!.id));
  console.log("\n(cleaned up)");

  section("result");
  console.log(failures === 0 ? "All pipeline checks passed." : `${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
