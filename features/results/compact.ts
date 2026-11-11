import { reactionPayloadSchema, type PurchaseIntent, type PriceReaction } from "@/features/simulations/schemas";
import type { CompactReaction } from "./schemas";

export function compactFromJoin(row: {
  id: string;
  personaId: string;
  variantId: string;
  personaName: string;
  segmentKey: string;
  age: number;
  incomeBand: string | null;
  interestScore: number;
  purchaseIntent: string;
  priceReaction: string | null;
  willingnessToPay: number | null;
  wouldRecommend: boolean;
  isExtrapolated: boolean;
  payload: unknown;
}): CompactReaction {
  const payload = reactionPayloadSchema.safeParse(row.payload);
  return {
    id: row.id,
    personaId: row.personaId,
    variantId: row.variantId,
    personaName: row.personaName,
    segmentKey: row.segmentKey,
    age: row.age,
    incomeBand: row.incomeBand,
    interestScore: row.interestScore,
    purchaseIntent: row.purchaseIntent as PurchaseIntent,
    priceReaction: (row.priceReaction as PriceReaction | null) ?? null,
    willingnessToPay: row.willingnessToPay,
    wouldRecommend: row.wouldRecommend,
    isExtrapolated: row.isExtrapolated,
    firstImpression: payload.success ? payload.data.firstImpression : "",
    objections: payload.success ? payload.data.topObjections.map((o) => o.text) : [],
    wantedFeatures: payload.success ? payload.data.wantedFeatures : [],
    missingFeatures: payload.success ? payload.data.missingFeatures : [],
    whatWouldConvinceThem: payload.success ? payload.data.whatWouldConvinceThem : "",
  };
}
