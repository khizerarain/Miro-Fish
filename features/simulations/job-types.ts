import type { PurchaseIntent, PriceReaction } from "./schemas";

export type ReactionSample = {
  id: string;
  personaName: string;
  segmentKey: string;
  interestScore: number;
  purchaseIntent: PurchaseIntent;
  firstImpression: string;
  wouldRecommend: boolean;
  isExtrapolated: boolean;
};

export type ReactionTally = {
  stored: number;
  simulated: number;
  extrapolated: number;
  meanInterest: number | null;
  byIntent: Record<PurchaseIntent, number>;
  byPrice: Record<PriceReaction, number>;
  recommendYes: number;
  recommendNo: number;
};

export type SimulationStage = "queued" | "simulating" | "extrapolating" | "complete" | "failed" | "cancelled";

export type SimulationSnapshot = {
  jobId: string;
  experimentId: string;
  variantId: string;
  status: SimulationStage;
  stage: SimulationStage;
  total: number;
  anchors: number;
  completed: number;
  failed: number;
  error: string | null;
  positivityWarning: string | null;
  estimatedCostCents: number;
  actualCostCents: number;
  tally: ReactionTally;
  samples: ReactionSample[];
};
