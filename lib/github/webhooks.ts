import { z } from "zod";

/**
 * Only the fields we use. GitHub sends a lot more, and its payload shape is stable enough
 * that validating a subset keeps us from breaking on unrelated additions.
 */
const accountSchema = z.object({
  id: z.number().int(),
  login: z.string().min(1),
  type: z.string().min(1),
});

const installationSchema = z.object({
  id: z.number().int(),
  account: accountSchema,
  suspended_at: z.string().nullable().optional(),
});

export const installationEventSchema = z.object({
  action: z.enum(["created", "deleted", "suspend", "unsuspend", "added", "removed", "new_permissions_accepted"]),
  installation: installationSchema,
  repositories: z
    .array(z.object({ id: z.number().int(), full_name: z.string().min(1), default_branch: z.string().nullable().optional() }))
    .optional(),
  repository_selection: z.string().optional(),
});

export type InstallationEvent = z.infer<typeof installationEventSchema>;

export const installationRepositoriesEventSchema = z.object({
  action: z.enum(["added", "removed"]),
  installation: installationSchema,
  repositories_added: z
    .array(z.object({ id: z.number().int(), full_name: z.string().min(1), default_branch: z.string().nullable().optional() }))
    .default([]),
  repositories_removed: z
    .array(z.object({ id: z.number().int(), full_name: z.string().min(1) }))
    .default([]),
});

export type InstallationRepositoriesEvent = z.infer<typeof installationRepositoriesEventSchema>;

const pullRequestSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  html_url: z.string(),
  body: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  user: z.object({ login: z.string() }).nullable().optional(),
  head: z.object({ sha: z.string(), ref: z.string() }).optional(),
  base: z.object({ sha: z.string(), ref: z.string() }).optional(),
  additions: z.number().int().optional(),
  deletions: z.number().int().optional(),
  changed_files: z.number().int().optional(),
  merged: z.boolean().optional(),
});

const repositorySchema = z.object({
  id: z.number().int(),
  full_name: z.string().min(1),
  default_branch: z.string().optional(),
});

export const pullRequestEventSchema = z.object({
  action: z.enum([
    "opened",
    "edited",
    "reopened",
    "synchronize",
    "closed",
    "ready_for_review",
    "converted_to_draft",
    "labeled",
    "unlabeled",
  ]),
  number: z.number().int().positive(),
  pull_request: pullRequestSchema,
  repository: repositorySchema,
  installation: z.object({ id: z.number().int() }).optional(),
  sender: z.object({ login: z.string() }).optional(),
});

export type PullRequestEvent = z.infer<typeof pullRequestEventSchema>;

/** PR actions that actually change what a customer would see. Everything else is ignored. */
export const REVIEWABLE_ACTIONS = new Set(["opened", "reopened", "ready_for_review", "synchronize"]);

export type GithubWebhook =
  | { kind: "installation"; payload: InstallationEvent }
  | { kind: "installation_repositories"; payload: InstallationRepositoriesEvent }
  | { kind: "pull_request"; payload: PullRequestEvent }
  | { kind: "ping" }
  | { kind: "ignored"; reason: string };

/** Parses a delivery into a known event. Unknown events are not errors — they are reported as ignored. */
export function parseWebhook(event: string, body: unknown): GithubWebhook {
  switch (event) {
    case "ping":
      return { kind: "ping" };
    case "installation": {
      const p = installationEventSchema.safeParse(body);
      return p.success ? { kind: "installation", payload: p.data } : { kind: "ignored", reason: "Invalid installation payload." };
    }
    case "installation_repositories": {
      const p = installationRepositoriesEventSchema.safeParse(body);
      return p.success
        ? { kind: "installation_repositories", payload: p.data }
        : { kind: "ignored", reason: "Invalid installation_repositories payload." };
    }
    case "pull_request": {
      const p = pullRequestEventSchema.safeParse(body);
      return p.success ? { kind: "pull_request", payload: p.data } : { kind: "ignored", reason: "Invalid pull_request payload." };
    }
    default:
      return { kind: "ignored", reason: `Event "${event}" is not handled.` };
  }
}
