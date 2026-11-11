import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const authProviderEnum = pgEnum("auth_provider", ["local", "supabase"]);
export const ideaStatusEnum = pgEnum("idea_status", ["draft", "analyzing", "analyzed", "confirmed"]);
export const audienceStatusEnum = pgEnum("audience_status", ["draft", "generating", "ready", "failed"]);
export const runStatusEnum = pgEnum("run_status", [
  "draft",
  "queued",
  "generating",
  "simulating",
  "analyzing",
  "complete",
  "failed",
  "cancelled",
]);
export const jobTypeEnum = pgEnum("job_type", ["analyze_idea", "generate_personas", "simulate", "analyze_results"]);
export const purchaseIntentEnum = pgEnum("purchase_intent", ["none", "low", "medium", "high"]);
export const priceReactionEnum = pgEnum("price_reaction", ["too_cheap", "fair", "expensive", "unaffordable"]);
export const githubRunStatusEnum = pgEnum("github_run_status", [
  "queued",
  "briefing",
  "simulating",
  "analyzing",
  "complete",
  "failed",
  "skipped",
  "cancelled",
]);
export const insightKindEnum = pgEnum("insight_kind", [
  "headline",
  "objection_cluster",
  "feature_cluster",
  "pricing",
  "messaging",
  "recommendation",
  "validation",
  "comparison",
]);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    authProvider: authProviderEnum("auth_provider").notNull(),
    /** Supabase auth user id; null for local accounts. */
    externalAuthId: text("external_auth_id"),
    /** scrypt hash; only set for local accounts. */
    passwordHash: text("password_hash"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_external_auth_id_idx").on(t.externalAuthId)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("projects_owner_idx").on(t.ownerId, t.updatedAt)],
);

export const ideas = pgTable(
  "ideas",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title"),
    description: text("description"),
    url: text("url"),
    urlExtract: text("url_extract"),
    pricing: jsonb("pricing"),
    adHeadline: text("ad_headline"),
    adCopy: text("ad_copy"),
    adChannel: text("ad_channel"),
    /** Downscaled data URL. Move to object storage before production. */
    adImageUrl: text("ad_image_url"),
    /** Zod-validated LLM analysis, editable by the user. */
    analysis: jsonb("analysis"),
    /** Hash of the inputs the current analysis was generated from; detects stale analyses. */
    analyzedInputHash: text("analyzed_input_hash"),
    status: ideaStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [index("ideas_owner_idx").on(t.ownerId, t.updatedAt), index("ideas_project_idx").on(t.projectId)],
);

export const audiences = pgTable(
  "audiences",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** Segments, weights, and filters. */
    definition: jsonb("definition").notNull().default({}),
    size: integer("size").notNull().default(100),
    seed: integer("seed").notNull(),
    isTemplate: boolean("is_template").notNull().default(false),
    status: audienceStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [
    index("audiences_owner_idx").on(t.ownerId, t.updatedAt),
    index("audiences_template_idx").on(t.ownerId, t.isTemplate),
  ],
);

export const personas = pgTable(
  "personas",
  {
    id: id(),
    audienceId: uuid("audience_id")
      .notNull()
      .references(() => audiences.id, { onDelete: "cascade" }),
    /** Position in the seeded population; stable across reruns. */
    ordinal: integer("ordinal").notNull(),
    segmentKey: text("segment_key").notNull(),
    name: text("name").notNull(),
    age: integer("age").notNull(),
    gender: text("gender"),
    location: text("location"),
    profession: text("profession"),
    incomeBand: text("income_band"),
    techComfort: integer("tech_comfort"),
    /** Full Zod-validated persona profile. */
    profile: jsonb("profile").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("personas_audience_ordinal_idx").on(t.audienceId, t.ordinal),
    index("personas_audience_segment_idx").on(t.audienceId, t.segmentKey),
  ],
);

export const experiments = pgTable(
  "experiments",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "set null" }),
    audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: runStatusEnum("status").notNull().default("draft"),
    seed: integer("seed").notNull(),
    estimatedCostCents: integer("estimated_cost_cents"),
    actualCostCents: integer("actual_cost_cents").notNull().default(0),
    costCapCents: integer("cost_cap_cents"),
    /** Copied from the previous run when this experiment is an "improve and rerun". */
    parentExperimentId: uuid("parent_experiment_id"),
    /** Short note of what changed from the parent (recommendation title, duplicate, etc.). */
    changeSummary: text("change_summary"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("experiments_owner_idx").on(t.ownerId, t.updatedAt),
    index("experiments_project_idx").on(t.projectId, t.createdAt),
    index("experiments_status_idx").on(t.status),
  ],
);

export const experimentVariants = pgTable(
  "experiment_variants",
  {
    id: id(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    isControl: boolean("is_control").notNull().default(false),
    /** What differs in this variant: copy, pricing, value prop, etc. */
    content: jsonb("content").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("variants_experiment_label_idx").on(t.experimentId, t.label)],
);

export const reactions = pgTable(
  "reactions",
  {
    id: id(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => experimentVariants.id, { onDelete: "cascade" }),
    personaId: uuid("persona_id")
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    interestScore: integer("interest_score").notNull(),
    purchaseIntent: purchaseIntentEnum("purchase_intent").notNull(),
    priceReaction: priceReactionEnum("price_reaction"),
    willingnessToPay: real("willingness_to_pay"),
    wouldRecommend: boolean("would_recommend").notNull(),
    /** True when inferred from anchor personas rather than simulated directly. */
    isExtrapolated: boolean("is_extrapolated").notNull().default(false),
    /** Full Zod-validated reaction (first impression, objections, features...). */
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reactions_variant_persona_idx").on(t.variantId, t.personaId),
    index("reactions_experiment_idx").on(t.experimentId),
    index("reactions_persona_idx").on(t.personaId),
  ],
);

export const insights = pgTable(
  "insights",
  {
    id: id(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => experimentVariants.id, { onDelete: "cascade" }),
    kind: insightKindEnum("kind").notNull(),
    payload: jsonb("payload").notNull(),
    promptVersion: text("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("insights_experiment_kind_idx").on(t.experimentId, t.kind)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: jobTypeEnum("type").notNull(),
    status: runStatusEnum("status").notNull().default("queued"),
    experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "cascade" }),
    audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "cascade" }),
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
    totalUnits: integer("total_units").notNull().default(0),
    completedUnits: integer("completed_units").notNull().default(0),
    failedUnits: integer("failed_units").notNull().default(0),
    /** Resume state (e.g. completed batch indexes). */
    checkpoint: jsonb("checkpoint"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("jobs_owner_idx").on(t.ownerId, t.createdAt),
    index("jobs_status_idx").on(t.status),
    index("jobs_experiment_idx").on(t.experimentId),
    index("jobs_audience_idx").on(t.audienceId),
  ],
);

/** One thread per persona × variant. Interactive chat is 1:1, not a population batch. */
export const chats = pgTable(
  "chats",
  {
    id: id(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    personaId: uuid("persona_id")
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => experimentVariants.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("chats_experiment_persona_variant_idx").on(t.experimentId, t.personaId, t.variantId),
    index("chats_experiment_idx").on(t.experimentId),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** mode, updatedIntent, updatedScore for convince-me turns. */
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_chat_idx").on(t.chatId, t.createdAt)],
);

export const researchNotes = pgTable(
  "research_notes",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    personaId: uuid("persona_id").references(() => personas.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => experimentVariants.id, { onDelete: "set null" }),
    quote: text("quote").notNull(),
    context: text("context"),
    source: text("source").notNull().default("chat"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("research_notes_experiment_idx").on(t.experimentId, t.createdAt)],
);

export const realityImports = pgTable(
  "reality_imports",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    kind: text("kind").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reality_imports_experiment_idx").on(t.experimentId, t.createdAt)],
);

/** One GitHub App installation (org or personal account) that can post simulated reactions on PRs. */
export const githubInstallations = pgTable(
  "github_installations",
  {
    id: id(),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    accountId: bigint("account_id", { mode: "number" }),
    /** Who installed the app inside Miro Fish. Set when the install callback carries a session. */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("github_installations_installation_idx").on(t.installationId), index("github_installations_owner_idx").on(t.ownerId)],
);

/** A connected repository. Each repo points at the audience whose simulated customers review its PRs. */
export const githubRepos = pgTable(
  "github_repos",
  {
    id: id(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => githubInstallations.id, { onDelete: "cascade" }),
    repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch"),
    /** The population that reacts. Null until the owner picks one. */
    audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
    /** The idea/product brief those customers are evaluating. Optional: derived from the PR diff otherwise. */
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "set null" }),
    /** Post and update a PR comment. */
    commentEnabled: boolean("comment_enabled").notNull().default(true),
    /** Publish a check run. Neutral conclusion — it never blocks a merge. */
    checkEnabled: boolean("check_enabled").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("github_repos_repository_idx").on(t.repositoryId),
    index("github_repos_installation_idx").on(t.installationId),
  ],
);

/** Every delivered webhook, so redeliveries are ignored and the event log is inspectable. */
export const githubDeliveries = pgTable(
  "github_deliveries",
  {
    id: id(),
    deliveryId: text("delivery_id").notNull(),
    event: text("event").notNull(),
    action: text("action"),
    /** e.g. owner/repo#12 — helps when debugging from the settings page. */
    subject: text("subject"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("github_deliveries_delivery_idx").on(t.deliveryId)],
);

/**
 * One simulated review of one pull request. Status drives the UI and the check run;
 * all numbers posted to GitHub are recomputed from stored reactions.
 */
export const githubPrRuns = pgTable(
  "github_pr_runs",
  {
    id: id(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => githubRepos.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    prTitle: text("pr_title").notNull(),
    prBody: text("pr_body"),
    prUrl: text("pr_url").notNull(),
    headSha: text("head_sha"),
    authorLogin: text("author_login"),
    status: githubRunStatusEnum("status").notNull().default("queued"),
    /** Set when the run completes or fails: why it was skipped, or the error. */
    statusDetail: text("status_detail"),
    /** What customers were shown: the brief derived from the diff. */
    brief: jsonb("brief"),
    /** The experiment that holds the reactions for this PR. */
    experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
    /** Narrative written around computed stats once the simulation finishes. */
    narrative: jsonb("narrative"),
    /** The exact markdown posted to GitHub, kept so edits can be diffed. */
    commentBody: text("comment_body"),
    commentId: bigint("comment_id", { mode: "number" }),
    checkRunId: bigint("check_run_id", { mode: "number" }),
    filesChanged: integer("files_changed").notNull().default(0),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("github_pr_runs_repo_pr_idx").on(t.repoId, t.prNumber),
    index("github_pr_runs_repo_idx").on(t.repoId, t.createdAt),
    index("github_pr_runs_status_idx").on(t.status),
  ],
);

export type GithubInstallation = typeof githubInstallations.$inferSelect;
export type GithubRepo = typeof githubRepos.$inferSelect;
export type GithubDelivery = typeof githubDeliveries.$inferSelect;
export type GithubPrRun = typeof githubPrRuns.$inferSelect;

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Experiment = typeof experiments.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ResearchNote = typeof researchNotes.$inferSelect;
export type RealityImport = typeof realityImports.$inferSelect;
