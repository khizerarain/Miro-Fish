import type { PurchaseIntent, PriceReaction } from "./schemas";
import type { ReactionTally } from "./job-types";

const emptyIntent = (): Record<PurchaseIntent, number> => ({ none: 0, low: 0, medium: 0, high: 0 });
const emptyPrice = (): Record<PriceReaction, number> => ({
  too_cheap: 0,
  fair: 0,
  expensive: 0,
  unaffordable: 0,
});

export function emptyTally(): ReactionTally {
  return {
    stored: 0,
    simulated: 0,
    extrapolated: 0,
    meanInterest: null,
    byIntent: emptyIntent(),
    byPrice: emptyPrice(),
    recommendYes: 0,
    recommendNo: 0,
  };
}

export function tallyFromRows(
  rows: {
    interestScore: number;
    purchaseIntent: string;
    priceReaction: string | null;
    wouldRecommend: boolean;
    isExtrapolated: boolean;
  }[],
): ReactionTally {
  const t = emptyTally();
  if (!rows.length) return t;
  let sum = 0;
  for (const r of rows) {
    t.stored++;
    if (r.isExtrapolated) t.extrapolated++;
    else t.simulated++;
    sum += r.interestScore;
    const intent = r.purchaseIntent as PurchaseIntent;
    if (intent in t.byIntent) t.byIntent[intent]++;
    if (r.priceReaction && r.priceReaction in t.byPrice) t.byPrice[r.priceReaction as PriceReaction]++;
    if (r.wouldRecommend) t.recommendYes++;
    else t.recommendNo++;
  }
  t.meanInterest = Math.round((sum / rows.length) * 10) / 10;
  return t;
}
