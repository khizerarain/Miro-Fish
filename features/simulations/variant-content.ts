import { analysisSchema, pricingSchema } from "@/features/ideas/schemas";
import type { VariantContent } from "./schemas";

export function variantContentFromIdea(idea: {
  analysis: unknown;
  pricing: unknown;
  adHeadline: string | null;
  adCopy: string | null;
}): VariantContent {
  const analysis = analysisSchema.safeParse(idea.analysis);
  const pricing = pricingSchema.safeParse(idea.pricing);
  const plans = pricing.success ? pricing.data.plans : [];
  const listed = plans.map((p) => p.price).find((n) => n != null) ?? null;
  return {
    summary: analysis.success ? analysis.data.summary : "",
    valueProposition: analysis.success ? analysis.data.valueProposition : "",
    keyFeatures: analysis.success ? analysis.data.keyFeatures : [],
    pricingSummary: analysis.success ? analysis.data.pricingSummary : "",
    listedPrice: listed,
    currency: pricing.success ? pricing.data.currency : "USD",
    adHeadline: idea.adHeadline ?? "",
    adCopy: idea.adCopy ?? "",
  };
}
