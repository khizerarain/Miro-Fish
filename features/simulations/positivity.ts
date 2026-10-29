import type { ReactionLlm } from "./schemas";

export type PositivityReport = {
  tooPositive: boolean;
  meanInterest: number;
  highIntentShare: number;
  recommendShare: number;
  hotShare: number;
  reasons: string[];
};

/** Flags a batch that looks like generic LLM cheerleading rather than mixed human reactions. */
export function positivityReport(reactions: ReactionLlm[]): PositivityReport {
  const n = reactions.length || 1;
  const meanInterest = reactions.reduce((s, r) => s + r.interestScore, 0) / n;
  const highIntentShare =
    reactions.filter((r) => r.purchaseIntent === "medium" || r.purchaseIntent === "high").length / n;
  const recommendShare = reactions.filter((r) => r.wouldRecommend).length / n;
  const hotShare = reactions.filter((r) => r.interestScore >= 70).length / n;
  const reasons: string[] = [];
  if (meanInterest > 62) reasons.push(`mean simulated interest ${Math.round(meanInterest)}`);
  if (highIntentShare > 0.55) reasons.push(`${Math.round(highIntentShare * 100)}% medium/high intent`);
  if (recommendShare > 0.42) reasons.push(`${Math.round(recommendShare * 100)}% would recommend`);
  if (hotShare > 0.5) reasons.push(`${Math.round(hotShare * 100)}% scored 70+`);
  return {
    tooPositive: reasons.length > 0,
    meanInterest,
    highIntentShare,
    recommendShare,
    hotShare,
    reasons,
  };
}

export const POSITIVITY_RETRY_NOTE = `The previous batch was unrealistically positive. Redo it.
Stay in character. Most people should be indifferent or unconvinced. Mean interest should land well below 50.
wouldRecommend must be false for the majority. Include people who would ignore this entirely.`;
