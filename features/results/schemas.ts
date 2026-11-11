import { z } from "zod";
import { purchaseIntentSchema, type PurchaseIntent, type PriceReaction } from "@/features/simulations/schemas";
import { EFFORT, IMPACT } from "./constants";

export const dashboardFilterSchema = z.object({
  segment: z.string().min(1).max(80).default("all"),
  age: z.string().min(1).max(16).default("all"),
  income: z.string().min(1).max(40).default("all"),
  intent: z.union([z.literal("all"), purchaseIntentSchema]).default("all"),
});

export type DashboardFilters = z.infer<typeof dashboardFilterSchema>;

export const emptyFilters = (): DashboardFilters => ({
  segment: "all",
  age: "all",
  income: "all",
  intent: "all",
});

/** Compact row the dashboard computes from. Demographics + scored fields + quote text. */
export type CompactReaction = {
  id: string;
  personaId: string;
  variantId: string;
  personaName: string;
  segmentKey: string;
  age: number;
  incomeBand: string | null;
  interestScore: number;
  purchaseIntent: PurchaseIntent;
  priceReaction: PriceReaction | null;
  willingnessToPay: number | null;
  wouldRecommend: boolean;
  isExtrapolated: boolean;
  firstImpression: string;
  objections: string[];
  wantedFeatures: string[];
  missingFeatures: string[];
  whatWouldConvinceThem: string;
};

const phrase = z.string().trim().min(2).max(200);

export const themeMapSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/),
  label: z.string().trim().min(3).max(80),
  phrases: z.array(phrase).min(1).max(24),
});

export const analyzeResultsSchema = z.object({
  headlines: z
    .array(
      z.object({
        text: z.string().trim().min(12).max(200),
        evidence: z.string().trim().min(4).max(160),
      }),
    )
    .length(3),
  objectionThemes: z.array(themeMapSchema).min(3).max(8),
  featureThemes: z.array(themeMapSchema).min(3).max(8),
  pricingTakeaway: z.string().trim().min(20).max(500),
  messaging: z.object({
    resonated: z.array(z.string().trim().min(8).max(220)).min(2).max(5),
    confused: z.array(z.string().trim().min(8).max(220)).min(2).max(5),
  }),
  recommendations: z
    .array(
      z.object({
        title: z.string().trim().min(8).max(90),
        detail: z.string().trim().min(20).max(400),
        impact: z.enum(IMPACT),
        effort: z.enum(EFFORT),
        evidence: z.string().trim().min(8).max(180),
      }),
    )
    .min(3)
    .max(6),
  validation: z.object({
    interviews: z.array(z.string().trim().min(12).max(240)).min(3).max(6),
    surveys: z.array(z.string().trim().min(12).max(240)).min(3).max(6),
  }),
});

export type AnalyzeResults = z.infer<typeof analyzeResultsSchema>;
export type ThemeMap = z.infer<typeof themeMapSchema>;

export const narrativePayloadSchema = analyzeResultsSchema;
export type NarrativePayload = AnalyzeResults;
