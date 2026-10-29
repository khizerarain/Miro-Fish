import { z } from "zod";
import { SIMULATION_BATCH_SIZE } from "./constants";

export const purchaseIntentSchema = z.enum(["none", "low", "medium", "high"]);
export const priceReactionSchema = z.enum(["too_cheap", "fair", "expensive", "unaffordable"]);

export type PurchaseIntent = z.infer<typeof purchaseIntentSchema>;
export type PriceReaction = z.infer<typeof priceReactionSchema>;

const short = (max: number) => z.string().trim().min(1).max(max);

export const objectionSchema = z.object({
  rank: z.number().int().min(1).max(8),
  text: short(200),
});

/** LLM-authored reaction. Demographics stay on the persona row. */
export const reactionLlmSchema = z.object({
  ordinal: z.number().int().min(0),
  firstImpression: z.string().trim().min(20).max(400),
  interestScore: z.number().int().min(0).max(100),
  purchaseIntent: purchaseIntentSchema,
  willingnessToPay: z.number().min(0).max(1_000_000).nullable(),
  priceReaction: priceReactionSchema,
  topObjections: z.array(objectionSchema).min(1).max(5),
  wantedFeatures: z.array(short(120)).max(5),
  missingFeatures: z.array(short(120)).max(5),
  whatWouldConvinceThem: z.string().trim().min(8).max(400),
  wouldRecommend: z.boolean(),
  recommendReason: z.string().trim().min(8).max(240),
});

export const reactionBatchSchema = z.object({
  reactions: z.array(reactionLlmSchema).min(1).max(SIMULATION_BATCH_SIZE),
});

export const reactionPayloadSchema = reactionLlmSchema.extend({
  personaId: z.uuid(),
  extrapolatedFromPersonaId: z.uuid().nullable(),
  fallback: z.boolean(),
});

export type ReactionLlm = z.infer<typeof reactionLlmSchema>;
export type ReactionPayload = z.infer<typeof reactionPayloadSchema>;

export type CompactPersona = {
  id: string;
  ordinal: number;
  name: string;
  age: number;
  gender: string | null;
  location: string | null;
  profession: string | null;
  incomeBand: string | null;
  techComfort: number | null;
  segmentKey: string;
  traits: string[];
  needs: string[];
  painPoints: string[];
  alternatives: string[];
  buyingStyle: string;
  priceSensitivity: string;
  financial: string;
};

export type VariantContent = {
  summary: string;
  valueProposition: string;
  keyFeatures: string[];
  pricingSummary: string;
  listedPrice: number | null;
  currency: string;
  adHeadline: string;
  adCopy: string;
};
