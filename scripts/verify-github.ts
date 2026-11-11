/**
 * Local verification for the GitHub integration.
 * Exercises the parts that can run without network calls to GitHub:
 *   - webhook signature verification (valid, tampered, malformed)
 *   - webhook payload parsing and action filtering
 *   - the diff → brief heuristic path
 *   - the full simulation → stats → comment pipeline against a real audience
 *
 * Run: npx tsx scripts/verify-github.ts
 */
import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

import { createHmac } from "node:crypto";

function section(name: string) {
  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 60 - name.length))}`);
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  // ------------------------------------------------------------------ signature
  section("webhook signature");
  const { verifyWebhookSignature } = await import("../lib/github/signature");
  const secret = "test-webhook-secret-value-1234";
  const body = JSON.stringify({ action: "opened", number: 7 });

  const good = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  check("accepts a correctly signed body", verifyWebhookSignature(body, good, secret));
  check("rejects a wrong secret", !verifyWebhookSignature(body, good, "another-secret-entirely"));
  check("rejects a tampered body", !verifyWebhookSignature(`${body} `, good, secret));
  check("rejects a missing header", !verifyWebhookSignature(body, null, secret));
  check("rejects a sha1 header", !verifyWebhookSignature(body, good.replace("sha256=", "sha1="), secret));
  check("rejects a truncated digest", !verifyWebhookSignature(body, good.slice(0, 20), secret));

  // ------------------------------------------------------------------ parsing
  section("webhook parsing");
  const { parseWebhook, REVIEWABLE_ACTIONS } = await import("../lib/github/webhooks");
  const prPayload = {
    action: "opened",
    number: 12,
    pull_request: {
      number: 12,
      title: "Add usage-based pricing page",
      html_url: "https://github.com/o/r/pull/12",
      body: "Adds a pricing calculator.",
      draft: false,
      user: { login: "octocat" },
      head: { sha: "abc123", ref: "feature/pricing" },
      base: { sha: "def456", ref: "main" },
      additions: 120,
      deletions: 8,
      changed_files: 4,
    },
    repository: { id: 99, full_name: "khizerarain/miro-fish", default_branch: "main" },
    installation: { id: 4242 },
    sender: { login: "octocat" },
  };
  const parsed = parseWebhook("pull_request", prPayload);
  check("parses a pull_request event", parsed.kind === "pull_request");
  if (parsed.kind === "pull_request") {
    check("keeps the PR number", parsed.payload.number === 12);
    check("keeps the installation id", parsed.payload.installation?.id === 4242);
  }
  check("accepts the opened action", REVIEWABLE_ACTIONS.has("opened"));
  check("rejects the closed action", !REVIEWABLE_ACTIONS.has("closed"));
  check("rejects the labeled action", !REVIEWABLE_ACTIONS.has("labeled"));
  check("ignores unknown events", parseWebhook("workflow_run", {}).kind === "ignored");
  check("reports a malformed payload", parseWebhook("pull_request", { nope: true }).kind === "ignored");

  const installParsed = parseWebhook("installation", {
    action: "created",
    installation: { id: 4242, account: { id: 1, login: "khizerarain", type: "User" } },
    repositories: [{ id: 99, full_name: "khizerarain/miro-fish", default_branch: "main" }],
  });
  check("parses an installation event", installParsed.kind === "installation");

  // ------------------------------------------------------------------ brief heuristics
  section("brief heuristics");
  const { isInternalPath, mockChangeBrief } = await import("../features/github/brief");
  check("treats .github/ as internal", isInternalPath(".github/workflows/ci.yml"));
  check("treats tests as internal", isInternalPath("lib/foo.test.ts"));
  check("treats __tests__ as internal", isInternalPath("features/x/__tests__/y.ts"));
  check("treats lockfiles as internal", isInternalPath("package-lock.json"));
  check("treats docs as internal", isInternalPath("README.md"));
  check("treats app code as customer-visible", !isInternalPath("app/checkout/page.tsx"));

  const internalBrief = mockChangeBrief({
    title: "Bump eslint",
    body: "",
    files: ["package-lock.json", ".github/workflows/ci.yml"],
  });
  check("marks an all-internal PR as not customer visible", internalBrief.customerVisible === false);
  check("labels it internal_only", internalBrief.changeType === "internal_only");

  const featureBrief = mockChangeBrief({
    title: "Add a trial banner to checkout",
    body: "",
    files: ["app/checkout/page.tsx"],
  });
  check("marks a UI change as customer visible", featureBrief.customerVisible === true);

  const pricingBrief = mockChangeBrief({
    title: "New pricing plan tiers",
    body: "",
    files: ["app/pricing/page.tsx"],
  });
  check("detects a pricing change", pricingBrief.changeType === "pricing", pricingBrief.changeType);

  // ------------------------------------------------------------------ comment rendering
  section("comment rendering");
  const { computeDashboard } = await import("../features/results/compute");
  const { mockAnalyzeResults } = await import("../features/results/mock-narrative");
  const { renderComment, renderCheckSummary, renderSkippedSummary, COMMENT_MARKER } = await import(
    "../features/github/comment"
  );

  const fakeRows = Array.from({ length: 40 }, (_, i) => ({
    id: `r${i}`,
    personaId: `p${i}`,
    variantId: "v1",
    personaName: `Persona ${i}`,
    segmentKey: i % 2 ? "skeptics" : "operators",
    age: 22 + (i % 40),
    incomeBand: "40_75k",
    interestScore: [10, 20, 30, 45, 55, 62, 70, 80][i % 8]!,
    purchaseIntent: (["none", "low", "medium", "high"] as const)[i % 4]!,
    priceReaction: (["fair", "expensive", "unaffordable"] as const)[i % 3]!,
    willingnessToPay: 10 + i,
    wouldRecommend: i % 9 === 0,
    isExtrapolated: i > 30,
    firstImpression: `Persona ${i} would scroll past this. The pitch did not name my job.`,
    objections: ["Another login to manage", "Switching cost is real"],
    wantedFeatures: ["a dead-simple first run"],
    missingFeatures: ["a real example"],
    whatWouldConvinceThem: "A trial with my own data.",
  }));
  const stats = computeDashboard(fakeRows);
  const narrative = mockAnalyzeResults(stats, "a checkout banner");
  const bodyOut = renderComment({
    brief: featureBrief,
    stats,
    narrative,
    audienceName: "Checkout operators",
    audienceSize: 500,
    experimentHref: "http://localhost:3000/experiments/x/results",
    simulated: true,
    truncated: false,
  });

  check("includes the marker for idempotent updates", bodyOut.startsWith(COMMENT_MARKER));
  check("labels results as simulated", /Simulated results — not user research/.test(bodyOut));
  check("never says 'proves'", !/\bproves\b/i.test(bodyOut));
  check("never claims people will buy", !/\bwill buy\b/i.test(bodyOut));
  check("reports the computed mean", bodyOut.includes(`**${stats.meanInterest!.toFixed(1)}**`));
  check("reports the recommend count from data", bodyOut.includes(`${stats.recommendYes} / ${stats.n}`));
  check("notes extrapolated rows", bodyOut.includes("extrapolated from similar personas"));
  check("includes a validation section", bodyOut.includes("How to validate this"));
  check("includes the dashboard link", bodyOut.includes("experiments/x/results"));
  check("narrative quotes a real objection count", bodyOut.includes(`of ${stats.n} personas`));

  const noNarrative = renderComment({
    brief: featureBrief,
    stats,
    narrative: null,
    audienceName: "A",
    audienceSize: 1,
    experimentHref: "http://x/y",
    simulated: true,
    truncated: false,
  });
  check("still renders numbers when the narrative is missing", noNarrative.includes("Mean simulated interest"));
  check("says notes are still generating", /still generating/.test(noNarrative));

  const emptyStats = computeDashboard([]);
  const emptyBody = renderComment({
    brief: featureBrief,
    stats: emptyStats,
    narrative: null,
    audienceName: "A",
    audienceSize: 0,
    experimentHref: "http://x/y",
    simulated: true,
    truncated: false,
  });
  check("handles zero reactions without NaN", !/NaN|Infinity/.test(emptyBody));

  const checkSummary = renderCheckSummary({
    brief: featureBrief,
    stats,
    narrative,
    audienceName: "Checkout operators",
    audienceSize: 500,
    experimentHref: "http://x",
    simulated: true,
    truncated: false,
  });
  check("check summary is short", checkSummary.length < 600, `${checkSummary.length} chars`);
  check("check summary repeats the hypothesis label", /hypothesis/i.test(checkSummary));

  const skippedSummary = renderSkippedSummary(internalBrief);
  check("skipped summary explains why nothing ran", /No customer-visible change/.test(skippedSummary));

  // ------------------------------------------------------------------ "Everyone" audience
  section("everyone audience");
  const { EVERYONE_DEFINITION, EVERYONE_AUDIENCE_SIZE, EVERYONE_AUDIENCE_SEED } = await import(
    "../features/github/everyone"
  );
  const { audienceDefinitionSchema, segmentCounts } = await import("../features/audiences/schemas");
  const { allSkeletons } = await import("../features/audiences/allocate");
  check("definition passes the audience schema", audienceDefinitionSchema.safeParse(EVERYONE_DEFINITION).success);
  const everyoneCounts = segmentCounts(EVERYONE_DEFINITION, EVERYONE_AUDIENCE_SIZE);
  check(
    "segment counts add up to the audience size",
    Object.values(everyoneCounts).reduce((s, n) => s + n, 0) === EVERYONE_AUDIENCE_SIZE,
    JSON.stringify(everyoneCounts),
  );
  const everyoneSkeletons = allSkeletons(EVERYONE_AUDIENCE_SEED, EVERYONE_DEFINITION, EVERYONE_AUDIENCE_SIZE);
  const regionsSeen = new Set(everyoneSkeletons.map((s) => s.region));
  const ages = everyoneSkeletons.map((s) => s.age);
  check("spans every region", regionsSeen.size === 10, `${regionsSeen.size} regions`);
  check("spans young to old", Math.min(...ages) < 25 && Math.max(...ages) > 65, `${Math.min(...ages)}–${Math.max(...ages)}`);
  check(
    "same seed gives the same people",
    JSON.stringify(allSkeletons(EVERYONE_AUDIENCE_SEED, EVERYONE_DEFINITION, EVERYONE_AUDIENCE_SIZE)) ===
      JSON.stringify(everyoneSkeletons),
  );

  // ------------------------------------------------------------------ real DB pipeline
  section("database pipeline (real PGlite)");
  const { getDb } = await import("../db");
  const schema = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const { purgeTestUsers } = await import("./purge-test-users");
  await purgeTestUsers(db, "verify-");

  const suffix = Date.now().toString(36);
  const [user] = await db
    .insert(schema.users)
    .values({ email: `verify-${suffix}@example.test`, authProvider: "local" })
    .returning();
  const [audience] = await db
    .insert(schema.audiences)
    .values({
      ownerId: user!.id,
      name: `Verify audience ${suffix}`,
      size: 12,
      seed: 7,
      status: "ready",
      definition: { segments: [{ key: "ops", label: "Ops", rationale: "", weight: 100, enabled: true, custom: false }], filters: {} },
    })
    .returning();

  const [inst] = await db
    .insert(schema.githubInstallations)
    .values({ installationId: Number(`9${Date.now() % 1_000_000}`), accountLogin: "khizerarain", accountType: "User", ownerId: user!.id })
    .returning();
  const [repo] = await db
    .insert(schema.githubRepos)
    .values({
      installationId: inst!.id,
      repositoryId: Number(`8${Date.now() % 1_000_000}`),
      fullName: "khizerarain/miro-fish",
      defaultBranch: "main",
      audienceId: audience!.id,
    })
    .returning();
  check("creates a repo linked to an audience", repo!.audienceId === audience!.id);

  // Dedupe: the same delivery id must only be recorded once.
  const { recordDelivery } = await import("../features/github/webhook-handlers");
  const deliveryId = `verify-${suffix}`;
  const first = await recordDelivery({ deliveryId, event: "pull_request", action: "opened", subject: "o/r#1" });
  const second = await recordDelivery({ deliveryId, event: "pull_request", action: "opened", subject: "o/r#1" });
  check("records a new delivery", first === true);
  check("ignores a redelivered delivery", second === false);

  // Personas, then a real simulation job driven through the same code path the webhook uses.
  const personaRows = Array.from({ length: 12 }, (_, i) => ({
    audienceId: audience!.id,
    ordinal: i,
    segmentKey: "ops",
    name: `Verify Persona ${i}`,
    age: 25 + i,
    profession: "Operations manager",
    incomeBand: "40_75k",
    techComfort: 3,
    profile: {
      ordinal: i,
      name: `Verify Persona ${i}`,
      financialSituation: "Pays for too many tools already.",
      personalityTraits: ["practical", "skeptical"],
      interests: ["productivity"],
      needs: ["fewer dashboards"],
      painPoints: ["switching cost"],
      currentAlternatives: ["a spreadsheet"],
      buyingBehavior: { style: "researcher", priceSensitivity: "high" },
      backstory: "Runs a small ops team and reviews every new tool with a skeptical eye before trying it out.",
      age: 25 + i,
      gender: "woman",
      location: "Chicago",
      region: "us_midwest",
      profession: "Operations manager",
      incomeBand: "40_75k",
      techComfort: 3,
      segmentKey: "ops",
    },
  }));
  await db.insert(schema.personas).values(personaRows);
  check("seeded personas", (await db.select().from(schema.personas).where(eq(schema.personas.audienceId, audience!.id))).length === 12);

  const { enqueueSimulationForContent } = await import("../features/github/simulate");
  const [exp] = await db
    .insert(schema.experiments)
    .values({ ownerId: user!.id, audienceId: audience!.id, name: `Verify ${suffix}`, status: "draft", seed: 42 })
    .returning();

  const { jobId } = await enqueueSimulationForContent({
    ownerId: user!.id,
    experimentId: exp!.id,
    audienceId: audience!.id,
    ideaId: null,
    content: {
      summary: featureBrief.featureSummary,
      valueProposition: featureBrief.customerFacingChange,
      keyFeatures: [],
      pricingSummary: "",
      listedPrice: null,
      currency: "USD",
      adHeadline: "Verify headline",
      adCopy: "Verify copy",
    },
    anchorIds: "all",
    personaTotal: 12,
  });
  check("enqueues a simulation job", Boolean(jobId));

  // MOCK_LLM=true keeps this offline and deterministic.
  const { ensureSimulationJobRunning, snapshotSimulationJob } = await import("../jobs/simulate-reactions");
  for (let i = 0; i < 20; i++) {
    await ensureSimulationJobRunning(jobId);
    const snap = await snapshotSimulationJob(jobId);
    if (snap?.status === "complete") break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const finalSnap = await snapshotSimulationJob(jobId);
  if (finalSnap?.status !== "complete") {
    const [jobRow] = await db
      .select({ status: schema.jobs.status, error: schema.jobs.error })
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId));
    console.log(`  (job status: ${jobRow?.status}, error: ${jobRow?.error})`);
  }
  check("simulation reaches complete", finalSnap?.status === "complete", finalSnap?.status);
  check("stored reactions for every persona", finalSnap?.tally.stored === 12, `${finalSnap?.tally.stored} stored`);

  const { loadCompactReactions } = await import("../features/results/queries");
  const realRows = await loadCompactReactions(exp!.id);
  check("reactions are readable for the dashboard", realRows.length === 12, `${realRows.length} rows`);

  const realStats = computeDashboard(realRows);
  check("interest scores vary across personas", new Set(realRows.map((r) => r.interestScore)).size > 3);
  check("not everything is positive", realStats.ignoring + realStats.hostile > 0, `ignoring ${realStats.ignoring}, hostile ${realStats.hostile}`);

  const realBody = renderComment({
    brief: featureBrief,
    stats: realStats,
    narrative: null,
    audienceName: audience!.name,
    audienceSize: 12,
    experimentHref: `http://localhost:3000/experiments/${exp!.id}/results`,
    simulated: true,
    truncated: false,
  });
  check("renders a comment from real simulated reactions", realBody.includes("Mean simulated interest"));
  check("comment has no placeholder dashes for the mean", !realBody.includes("| **—** |"));

  // ------------------------------------------------------------------ cleanup
  await db.delete(schema.users).where(eq(schema.users.id, user!.id));
  await db.delete(schema.audiences).where(eq(schema.audiences.id, audience!.id));
  await db.delete(schema.githubInstallations).where(eq(schema.githubInstallations.id, inst!.id));
  await db.delete(schema.githubDeliveries).where(eq(schema.githubDeliveries.deliveryId, deliveryId));
  console.log("\n(cleaned up verification rows)");

  section("result");
  console.log(failures === 0 ? "All checks passed." : `${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
