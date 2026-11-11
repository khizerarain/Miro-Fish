"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experimentVariants, insights } from "@/db/schema";
import { getExperimentForUser } from "@/features/results/queries";
import { startSimulationForVariant } from "@/features/simulations/actions";
import { ensureControlVariant, loadIdeaForExperiment } from "@/features/simulations/queries";
import { generateJson } from "@/lib/llm";
import { requireUser } from "@/lib/auth";
import { compareVariantsV1 } from "@/prompts/compare-variants.v1";
import { statsForLlm } from "./compare-compute";
import { mockComparisonNarrative } from "./mock-compare";
import { contentToForm, formToContent, listVariantCards, loadComparisonPack } from "./queries";
import {
  comparisonNarrativeSchema,
  MAX_VARIANTS,
  VARIANT_LABELS,
  variantFormSchema,
  type ComparisonNarrative,
  type VariantCard,
} from "./schemas";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();

export async function loadVariants(experimentId: string): Promise<{ ok: true; variants: VariantCard[]; seed: number } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false, error: "Unknown experiment." };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const idea = await loadIdeaForExperiment(exp.ideaId);
  await ensureControlVariant(exp.id, idea);
  return { ok: true, variants: await listVariantCards(exp.id), seed: exp.seed };
}

export async function createVariant(experimentId: string): Promise<{ ok: true; variantId: string } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const existing = await listVariantCards(exp.id);
  if (existing.length >= MAX_VARIANTS) return { ok: false, error: "This run already has Control, B, and C." };
  const used = new Set(existing.map((v) => v.label));
  const label = VARIANT_LABELS.find((l) => !used.has(l));
  if (!label) return { ok: false, error: "No free variant slot." };
  const control = existing.find((v) => v.isControl);
  if (!control) return { ok: false, error: "Run Control once so there is something to clone." };
  const db = await getDb();
  const [created] = await db
    .insert(experimentVariants)
    .values({
      experimentId: exp.id,
      label,
      isControl: false,
      content: formToContent(control.content),
    })
    .returning({ id: experimentVariants.id });
  return { ok: true, variantId: created.id };
}

export async function saveVariant(variantId: string, input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(variantId).success) return { ok: false, error: "Unknown variant." };
  const parsed = variantFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That copy did not look right." };
  const db = await getDb();
  const [row] = await db.select().from(experimentVariants).where(eq(experimentVariants.id, variantId)).limit(1);
  if (!row) return { ok: false, error: "This variant is gone." };
  const exp = await getExperimentForUser(user.id, row.experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  await db.update(experimentVariants).set({ content: formToContent(parsed.data) }).where(eq(experimentVariants.id, variantId));
  return { ok: true };
}

export async function removeVariant(variantId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(experimentVariants).where(eq(experimentVariants.id, variantId)).limit(1);
  if (!row) return { ok: false, error: "This variant is gone." };
  if (row.isControl) return { ok: false, error: "Control stays. Delete B or C instead." };
  const exp = await getExperimentForUser(user.id, row.experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  await db.delete(insights).where(and(eq(insights.experimentId, exp.id), eq(insights.kind, "comparison")));
  await db.delete(experimentVariants).where(eq(experimentVariants.id, variantId));
  return { ok: true };
}

export async function runVariant(experimentId: string, variantId: string) {
  return startSimulationForVariant(experimentId, variantId);
}

export async function loadCompare(experimentId: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false as const, error: "Unknown experiment." };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false as const, error: "This experiment no longer exists." };
  const pack = await loadComparisonPack(exp.id, exp.audienceId);
  return {
    ok: true as const,
    experimentId: exp.id,
    experimentName: exp.name,
    seed: exp.seed,
    ...pack,
  };
}

export async function generateComparison(experimentId: string): Promise<{ ok: true; narrative: ComparisonNarrative } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const pack = await loadComparisonPack(exp.id, exp.audienceId);
  if (pack.numbers.variants.length < 2) return { ok: false, error: "Run at least two variants against the same personas first." };

  const variantsJson = JSON.stringify(
    pack.variants.map((v) => ({
      label: v.label,
      isControl: v.isControl,
      summary: v.content.summary,
      valueProposition: v.content.valueProposition,
      adHeadline: v.content.adHeadline,
      listedPrice: v.content.listedPrice,
    })),
  );
  const statsJson = JSON.stringify(statsForLlm(pack.numbers));
  const out = await generateJson({
    prompt: compareVariantsV1,
    vars: {
      statsJson,
      variantsJson,
      jsonSchema: JSON.stringify(z.toJSONSchema(comparisonNarrativeSchema)),
    },
    schema: comparisonNarrativeSchema,
    mock: mockComparisonNarrative,
    mockDelayMs: 420,
  });

  const db = await getDb();
  await db.delete(insights).where(and(eq(insights.experimentId, exp.id), eq(insights.kind, "comparison")));
  await db.insert(insights).values({
    experimentId: exp.id,
    kind: "comparison",
    payload: out.data,
    promptVersion: "compare-variants@v1",
  });
  return { ok: true, narrative: out.data };
}

export { contentToForm };
