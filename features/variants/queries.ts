import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { experimentVariants, insights, reactions } from "@/db/schema";
import { loadCompactReactions, loadSegmentLabels } from "@/features/results/queries";
import { parseVariantContent } from "@/features/simulations/queries";
import { computeComparison, packVariant } from "./compare-compute";
import { comparisonNarrativeSchema, type ComparisonNarrative, type VariantCard, type VariantForm } from "./schemas";

export function contentToForm(raw: unknown): VariantForm {
  const c = parseVariantContent(raw);
  return {
    summary: c.summary,
    valueProposition: c.valueProposition,
    adHeadline: c.adHeadline,
    adCopy: c.adCopy,
    pricingSummary: c.pricingSummary,
    listedPrice: c.listedPrice,
    currency: c.currency,
    keyFeaturesText: c.keyFeatures.join("\n"),
  };
}

export function formToContent(form: VariantForm) {
  return {
    summary: form.summary,
    valueProposition: form.valueProposition,
    keyFeatures: form.keyFeaturesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12),
    pricingSummary: form.pricingSummary,
    listedPrice: form.listedPrice,
    currency: form.currency,
    adHeadline: form.adHeadline,
    adCopy: form.adCopy,
  };
}

export async function listVariantCards(experimentId: string): Promise<VariantCard[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(experimentVariants)
    .where(eq(experimentVariants.experimentId, experimentId));
  const counts = await Promise.all(
    rows.map(async (v) => {
      const [row] = await db.select({ n: count() }).from(reactions).where(eq(reactions.variantId, v.id));
      return [v.id, row?.n ?? 0] as const;
    }),
  );
  const nById = Object.fromEntries(counts);
  return rows
    .sort((a, b) => Number(b.isControl) - Number(a.isControl) || a.label.localeCompare(b.label))
    .map((v) => ({
      id: v.id,
      label: v.label,
      isControl: v.isControl,
      content: contentToForm(v.content),
      reactionCount: nById[v.id] ?? 0,
    }));
}

export async function loadComparisonPack(experimentId: string, audienceId: string | null) {
  const variants = await listVariantCards(experimentId);
  const labels = await loadSegmentLabels(audienceId);
  const packs = await Promise.all(
    variants.map(async (v) => {
      const rows = await loadCompactReactions(experimentId, v.id);
      return packVariant(v.id, v.label, v.isControl, rows, labels);
    }),
  );
  const numbers = computeComparison(packs);
  const narrative = await loadComparisonNarrative(experimentId);
  return { variants, numbers, narrative, segmentLabels: labels };
}

export async function loadComparisonNarrative(experimentId: string): Promise<ComparisonNarrative | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.experimentId, experimentId), eq(insights.kind, "comparison")))
    .limit(1);
  if (!row) return null;
  const parsed = comparisonNarrativeSchema.safeParse(row.payload);
  return parsed.success ? parsed.data : null;
}
