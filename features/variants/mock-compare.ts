import type { CompareVariantsVars } from "@/prompts/compare-variants.v1";
import type { ComparisonNarrative } from "./schemas";

export function mockComparisonNarrative(vars: CompareVariantsVars): ComparisonNarrative {
  let small = false;
  try {
    const stats = JSON.parse(vars.statsJson) as { smallDifference?: boolean; deltas?: { label: string; meanDelta: number | null }[] };
    small = Boolean(stats.smallDifference);
    const first = stats.deltas?.[0];
    const dir = first?.meanDelta != null && first.meanDelta > 0 ? "higher" : "lower";
    const label = first?.label ?? "the challenger";
    return {
      whyTheyDiffer: small
        ? `The computed simulated interest for ${label} sits close to Control. Copy and price differences showed up in a few objections, but the mean gap is small enough that ranking a winner would overclaim what this run can support.`
        : `${label} shows ${dir} simulated interest than Control on the stored scores. The gap lines up with the objection and pricing mix already counted — treat it as a hypothesis about messaging, not a forecast of who will buy.`,
      headlines: small
        ? [
            "Mean simulated interest barely moved between variants.",
            "Segment ranks overlap; no group clearly flipped.",
            "Use this to pick interview questions, not a ship decision.",
          ]
        : [
            `${label} moved simulated interest ${dir} versus Control on stored scores.`,
            "Segment winners and losers follow the computed means, not a story invented on top.",
            "Objections and price mix are the evidence trail for why the copy may have landed differently.",
          ],
      caution: small
        ? "The difference is small. Treat any ranking as a hypothesis and check it with real interviews."
        : "This comparison is simulated. Validate the leading hypothesis with interviews and a real A/B on the live page.",
    };
  } catch {
    return {
      whyTheyDiffer:
        "The stored scores are close enough that a story about why variants differ would be guesswork. Count the deltas, then interview real people.",
      headlines: [
        "Simulated interest deltas are modest.",
        "Use objections as interview prompts, not as proof.",
      ],
      caution: "Treat this comparison as a hypothesis. Differences may be noise.",
    };
  }
}
