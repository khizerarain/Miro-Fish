"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { ideas } from "@/db/schema";
import { analysisSchema } from "@/features/ideas/schemas";
import { cloneAudience, cloneExperiment, cloneIdea } from "@/features/experiments/clone";
import { getExperimentForUser } from "@/features/results/queries";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { generateJson } from "@/lib/llm";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertExperimentRoom } from "@/lib/usage";
import { improveIdeaV1 } from "@/prompts/improve-idea.v1";
import { mockImproveDraft } from "./mock";
import { improveDraftSchema, type ImproveDraft } from "./schemas";
import { revalidatePath } from "next/cache";

type Fail = { ok: false; error: string };

export async function draftImprovement(
  experimentId: string,
  recommendation: { title: string; detail: string; evidence: string },
): Promise<{ ok: true; draft: ImproveDraft } | Fail> {
  const user = await requireUser();
  try {
    enforceRateLimit(user.id, "improve-draft", 12, 60_000);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp?.ideaId) return { ok: false, error: "This run has no idea to edit." };
  const db = await getDb();
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, exp.ideaId)).limit(1);
  if (!idea) return { ok: false, error: "The idea for this run is missing." };
  const analysis = analysisSchema.safeParse(idea.analysis);

  const out = await generateJson({
    prompt: improveIdeaV1,
    vars: {
      recommendationJson: JSON.stringify(recommendation),
      ideaJson: JSON.stringify({
        title: idea.title,
        description: idea.description,
        valueProposition: analysis.success ? analysis.data.valueProposition : "",
        adHeadline: idea.adHeadline,
        adCopy: idea.adCopy,
      }),
      jsonSchema: JSON.stringify(z.toJSONSchema(improveDraftSchema)),
    },
    schema: improveDraftSchema,
    mock: mockImproveDraft,
    mockDelayMs: 420,
  });
  track("improve_drafted", { experimentId, title: recommendation.title });
  return { ok: true, draft: out.data };
}

export async function applyImprovement(
  experimentId: string,
  draft: ImproveDraft,
  opts: { editAudience: boolean },
): Promise<{ ok: true; experimentId: string; href: string } | Fail> {
  const user = await requireUser();
  const parsed = improveDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "That draft did not look right." };
  const room = await assertExperimentRoom(user.id);
  if (room) return { ok: false, error: room };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp?.ideaId) return { ok: false, error: "This run has no idea to edit." };

  const idea = await cloneIdea(exp.ideaId, user.id);
  if (!idea) return { ok: false, error: "Could not clone the idea." };
  const analysis = analysisSchema.safeParse(idea.analysis);
  const nextAnalysis = analysis.success
    ? { ...analysis.data, valueProposition: parsed.data.valueProposition, summary: analysis.data.summary }
    : idea.analysis;
  const db = await getDb();
  await db
    .update(ideas)
    .set({
      description: parsed.data.description,
      adHeadline: parsed.data.adHeadline || idea.adHeadline,
      adCopy: parsed.data.adCopy || idea.adCopy,
      analysis: nextAnalysis,
      status: "confirmed",
    })
    .where(eq(ideas.id, idea.id));

  const audience = exp.audienceId ? await cloneAudience(exp.audienceId, user.id) : null;
  const copy = await cloneExperiment({
    sourceId: exp.id,
    ownerId: user.id,
    name: `${exp.name} · improved`,
    ideaId: idea.id,
    audienceId: audience?.id ?? null,
    changeSummary: parsed.data.rationale.slice(0, 240),
    status: audience?.status === "ready" && !opts.editAudience ? "draft" : "draft",
  });
  if (!copy) return { ok: false, error: "Could not start the rerun." };
  track("improve_applied", { experimentId: copy.id, parent: exp.id });
  revalidatePath("/experiments");
  revalidatePath("/dashboard");
  if (copy.projectId) {
    revalidatePath("/projects");
    revalidatePath(`/projects/${copy.projectId}`);
  }
  const href = opts.editAudience
    ? `/experiments/${copy.id}/audience`
    : audience?.status === "ready"
      ? `/experiments/${copy.id}/simulate`
      : `/experiments/${copy.id}/audience`;
  return { ok: true, experimentId: copy.id, href };
}
