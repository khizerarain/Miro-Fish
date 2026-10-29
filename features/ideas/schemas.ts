import { z } from "zod";

export const LIMITS = {
  title: 120,
  description: 5000,
  descriptionMin: 40,
  descriptionIdealMin: 200,
  descriptionIdealMax: 2000,
  urlExtract: 12000,
  adHeadline: 200,
  adCopy: 3000,
  plans: 4,
  planFeatures: 600,
  /** Downscaled image data URL. */
  adImageBytes: 900_000,
} as const;

export const PRICING_MODELS = ["subscription", "one_time", "freemium", "usage_based", "free"] as const;
export const BILLING_PERIODS = ["month", "year", "one_time", "usage"] as const;
export const AD_CHANNELS = ["search", "social", "display", "email", "video", "print", "other"] as const;

export const planSchema = z.object({
  name: z.string().trim().max(60),
  price: z.number().min(0).max(1_000_000).nullable(),
  period: z.enum(BILLING_PERIODS),
  features: z.string().trim().max(LIMITS.planFeatures),
});

export const pricingSchema = z.object({
  model: z.enum(PRICING_MODELS),
  currency: z.string().trim().length(3).toUpperCase(),
  plans: z.array(planSchema).max(LIMITS.plans),
  notes: z.string().trim().max(600),
});

export type Pricing = z.infer<typeof pricingSchema>;
export type Plan = z.infer<typeof planSchema>;

export const emptyPricing = (): Pricing => ({ model: "subscription", currency: "USD", plans: [], notes: "" });

/** Everything the user enters in step 1. All optional while drafting. */
export const ideaInputSchema = z.object({
  title: z.string().trim().max(LIMITS.title),
  description: z.string().max(LIMITS.description),
  url: z.string().trim().max(2000),
  urlExtract: z.string().max(LIMITS.urlExtract),
  pricing: pricingSchema,
  adHeadline: z.string().max(LIMITS.adHeadline),
  adCopy: z.string().max(LIMITS.adCopy),
  adChannel: z.enum(AD_CHANNELS).nullable(),
  adImageUrl: z
    .string()
    .max(LIMITS.adImageBytes, "Image is too large")
    .refine((v) => v === "" || /^data:image\/(png|jpeg|webp);base64,/.test(v), "Unsupported image")
    .nullable(),
});

export type IdeaInput = z.infer<typeof ideaInputSchema>;

export const emptyIdeaInput = (): IdeaInput => ({
  title: "",
  description: "",
  url: "",
  urlExtract: "",
  pricing: emptyPricing(),
  adHeadline: "",
  adCopy: "",
  adChannel: null,
  adImageUrl: null,
});

export const hasPricing = (p: Pricing) => p.plans.some((plan) => plan.name.trim() || plan.price !== null);

/** Which inputs carry enough signal to analyze. Pricing alone isn't enough to understand a product. */
export function inputReadiness(input: IdeaInput) {
  const sources = {
    description: input.description.trim().length >= LIMITS.descriptionMin,
    url: input.urlExtract.trim().length >= LIMITS.descriptionMin,
    pricing: hasPricing(input.pricing),
    ad: (input.adHeadline + input.adCopy).trim().length >= 20,
  };
  return { sources, ready: sources.description || sources.url || sources.ad };
}

// ---------- Analysis (LLM output, user-editable) ----------

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const analysisSchema = z.object({
  summary: shortText(240),
  industry: shortText(80),
  category: shortText(80),
  targetMarkets: z
    .array(z.object({ segment: shortText(100), rationale: shortText(300) }))
    .min(1)
    .max(5),
  valueProposition: shortText(500),
  keyFeatures: z.array(shortText(160)).min(1).max(8),
  pricingSummary: shortText(400),
  likelyCompetitors: z.array(z.object({ name: shortText(80), whyRelevant: shortText(240) })).max(6),
  keyAssumptions: z
    .array(z.object({ assumption: shortText(240), risk: z.enum(["low", "medium", "high"]) }))
    .min(2)
    .max(6),
  /** What the model was unsure about, in plain words. */
  uncertainties: z.array(shortText(240)).max(4),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const IDEA_STATUSES = ["draft", "analyzing", "analyzed", "confirmed"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
