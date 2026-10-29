"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experiments, ideas, jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { dataUrlToImage, generateJson, LlmError } from "@/lib/llm";
import { analyzeIdeaV1 } from "@/prompts/analyze-idea.v1";
import { inputHash } from "./input-hash";
import { mockAnalyzeIdea } from "./mock-analysis";
import { pricingToText } from "./pricing-text";
import { getOwnedIdea, rowToWizardState, type WizardState } from "./queries";
import { type Analysis, analysisSchema, type IdeaInput, ideaInputSchema, inputReadiness } from "./schemas";
import { fetchAndExtract, type UrlExtractResult } from "./url-extract";

type Fail = { ok: false; error: string };

const idSchema = z.uuid();
const experimentName = (input: IdeaInput) => input.title.trim() || "Untitled idea";

function inputColumns(input: IdeaInput) {
  return {
    title: input.title.trim() || null,
    description: input.description,
    url: input.url.trim() || null,
    urlExtract: input.urlExtract || null,
    pricing: input.pricing,
    adHeadline: input.adHeadline || null,
    adCopy: input.adCopy || null,
    adChannel: input.adChannel,
    adImageUrl: input.adImageUrl || null,
  };
}

/** Creates the draft on first save, then updates it. Returns the id so the client can put it in the URL. */
export async function saveDraft(
  ideaId: string | null,
  rawInput: IdeaInput,
): Promise<{ ok: true; ideaId: string; savedAt: number } | Fail> {
  const user = await requireUser();
  const parsed = ideaInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;
  const db = await getDb();

  if (!ideaId) {
    const created = await db.transaction(async (tx) => {
      const [idea] = await tx
        .insert(ideas)
        .values({ ownerId: user.id, ...inputColumns(input) })
        .returning({ id: ideas.id, updatedAt: ideas.updatedAt });
      await tx.insert(experiments).values({
        ownerId: user.id,
        ideaId: idea.id,
        name: experimentName(input),
        seed: Math.floor(Math.random() * 2 ** 31),
      });
      return idea;
    });
    return { ok: true, ideaId: created.id, savedAt: created.updatedAt.getTime() };
  }

  const existing = await getOwnedIdea(user.id, ideaId);
  if (!existing) return { ok: false, error: "This draft no longer exists." };
  if (existing.status === "confirmed")
    return { ok: false, error: "This idea is confirmed. Choose Edit idea to change it." };

  const [updated] = await db
    .update(ideas)
    .set(inputColumns(input))
    .where(eq(ideas.id, ideaId))
    .returning({ updatedAt: ideas.updatedAt });
  await db
    .update(experiments)
    .set({ name: experimentName(input) })
    .where(and(eq(experiments.ideaId, ideaId), eq(experiments.ownerId, user.id)));
  return { ok: true, ideaId, savedAt: updated.updatedAt.getTime() };
}

export async function fetchUrl(url: string): Promise<UrlExtractResult> {
  await requireUser();
  return fetchAndExtract(z.string().max(2000).parse(url));
}

/** Runs (or returns the cached) AI analysis for the idea's current inputs. Idempotent per input hash. */
export async function analyzeIdea(
  ideaId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: true; state: WizardState } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(ideaId).success) return { ok: false, error: "Unknown draft." };
  const idea = await getOwnedIdea(user.id, ideaId);
  if (!idea) return { ok: false, error: "This draft no longer exists." };

  const state = rowToWizardState(idea);
  if (!inputReadiness(state.input).ready) {
    return { ok: false, error: "Add a description, website text, or ad copy before analyzing." };
  }
  const hash = inputHash(state.input);
  if (!opts.force && state.analysis && idea.analyzedInputHash === hash) {
    const db = await getDb();
    if (idea.status !== "analyzed" && idea.status !== "confirmed") {
      await db.update(ideas).set({ status: "analyzed" }).where(eq(ideas.id, ideaId));
    }
    return { ok: true, state: { ...state, status: idea.status === "confirmed" ? "confirmed" : "analyzed" } };
  }

  const db = await getDb();
  await db.update(ideas).set({ status: "analyzing" }).where(eq(ideas.id, ideaId));
  const [job] = await db
    .insert(jobs)
    .values({
      ownerId: user.id,
      type: "analyze_idea",
      status: "analyzing",
      ideaId,
      totalUnits: 1,
      startedAt: new Date(),
    })
    .returning({ id: jobs.id });

  const { input } = state;
  const image = input.adImageUrl ? dataUrlToImage(input.adImageUrl) : undefined;
  try {
    const { data, usage } = await generateJson({
      prompt: analyzeIdeaV1,
      vars: {
        title: input.title,
        description: input.description,
        url: input.url,
        urlExtract: input.urlExtract,
        pricing: pricingToText(input.pricing),
        adHeadline: input.adHeadline,
        adCopy: input.adCopy,
        adChannel: input.adChannel ?? "",
        hasImage: !!image,
        jsonSchema: JSON.stringify(z.toJSONSchema(analysisSchema)),
      },
      schema: analysisSchema,
      mock: mockAnalyzeIdea,
      images: image ? [image] : undefined,
    });

    const [updated] = await db
      .update(ideas)
      .set({ analysis: data, analyzedInputHash: hash, status: "analyzed" })
      .where(eq(ideas.id, ideaId))
      .returning();
    await db
      .update(jobs)
      .set({
        status: "complete",
        completedUnits: 1,
        attempts: usage.calls,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
    return { ok: true, state: rowToWizardState(updated) };
  } catch (err) {
    const message = err instanceof LlmError ? err.message : (err as Error).message;
    console.error("analyzeIdea failed", { ideaId, message });
    await db
      .update(ideas)
      .set({ status: state.analysis ? "analyzed" : "draft" })
      .where(eq(ideas.id, ideaId));
    await db
      .update(jobs)
      .set({ status: "failed", failedUnits: 1, error: message.slice(0, 1000), finishedAt: new Date() })
      .where(eq(jobs.id, job.id));
    return {
      ok: false,
      error:
        err instanceof LlmError && err.kind === "config"
          ? "AI analysis isn't configured. Set ANTHROPIC_API_KEY or turn on MOCK_LLM."
          : "We couldn't analyze your idea just now. Your inputs are saved, so try again in a moment.",
    };
  }
}

export async function saveAnalysis(ideaId: string, analysis: Analysis): Promise<{ ok: true; savedAt: number } | Fail> {
  const user = await requireUser();
  const idea = await getOwnedIdea(user.id, ideaId);
  if (!idea) return { ok: false, error: "This draft no longer exists." };
  if (idea.status === "confirmed") return { ok: false, error: "This idea is already confirmed." };
  const parsed = analysisSchema.safeParse(analysis);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid analysis" };
  const db = await getDb();
  const [updated] = await db
    .update(ideas)
    .set({ analysis: parsed.data })
    .where(eq(ideas.id, ideaId))
    .returning({ updatedAt: ideas.updatedAt });
  return { ok: true, savedAt: updated.updatedAt.getTime() };
}

export async function confirmIdea(ideaId: string, analysis: Analysis): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const idea = await getOwnedIdea(user.id, ideaId);
  if (!idea) return { ok: false, error: "This draft no longer exists." };
  const parsed = analysisSchema.safeParse(analysis);
  if (!parsed.success) return { ok: false, error: "Fill in the highlighted fields before confirming." };
  const db = await getDb();
  await db.update(ideas).set({ analysis: parsed.data, status: "confirmed" }).where(eq(ideas.id, ideaId));
  return { ok: true };
}

/** Reopens step 1. The existing analysis is kept and flagged stale if inputs change. */
export async function reopenIdea(ideaId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const idea = await getOwnedIdea(user.id, ideaId);
  if (!idea) return { ok: false, error: "This draft no longer exists." };
  const db = await getDb();
  await db.update(ideas).set({ status: "draft" }).where(eq(ideas.id, ideaId));
  return { ok: true };
}

export async function discardDraft(ideaId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const idea = await getOwnedIdea(user.id, ideaId);
  if (!idea) return { ok: false, error: "This draft no longer exists." };
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(experiments).where(and(eq(experiments.ideaId, ideaId), eq(experiments.status, "draft")));
    await tx.delete(ideas).where(eq(ideas.id, ideaId));
  });
  return { ok: true };
}
