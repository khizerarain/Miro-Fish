import { z } from "zod";

export const MAX_VARIANTS = 3;
export const VARIANT_LABELS = ["B", "C"] as const;

export const variantFormSchema = z.object({
  summary: z.string().trim().max(2000),
  valueProposition: z.string().trim().max(800),
  adHeadline: z.string().trim().max(200),
  adCopy: z.string().trim().max(3000),
  pricingSummary: z.string().trim().max(600),
  listedPrice: z.number().min(0).max(1_000_000).nullable(),
  currency: z.string().trim().length(3).toUpperCase(),
  keyFeaturesText: z.string().max(800),
});

export type VariantForm = z.infer<typeof variantFormSchema>;

export const comparisonNarrativeSchema = z.object({
  whyTheyDiffer: z.string().trim().min(40).max(1600),
  headlines: z.array(z.string().trim().min(12).max(220)).min(2).max(5),
  caution: z.string().trim().min(20).max(500),
});

export type ComparisonNarrative = z.infer<typeof comparisonNarrativeSchema>;

export type VariantCard = {
  id: string;
  label: string;
  isControl: boolean;
  content: VariantForm;
  reactionCount: number;
};
