import type { ImproveIdeaVars } from "@/prompts/improve-idea.v1";
import type { ImproveDraft } from "./schemas";

export function mockImproveDraft(vars: ImproveIdeaVars): ImproveDraft {
  let title = "the recommendation";
  try {
    const rec = JSON.parse(vars.recommendationJson) as { title?: string; detail?: string };
    title = rec.title ?? title;
  } catch {
    /* ignore */
  }
  let description = "Updated product description.";
  let valueProposition = "";
  let adHeadline = "";
  let adCopy = "";
  try {
    const idea = JSON.parse(vars.ideaJson) as {
      description?: string;
      valueProposition?: string;
      adHeadline?: string;
      adCopy?: string;
    };
    description = idea.description?.trim() || description;
    valueProposition = idea.valueProposition ?? "";
    adHeadline = idea.adHeadline ?? "";
    adCopy = idea.adCopy ?? "";
  } catch {
    /* ignore */
  }
  const extra = ` Change on this rerun: address “${title}” with a plainer first-run and a price a solo operator can expense.`;
  return {
    description: (description + extra).slice(0, 5000),
    valueProposition: valueProposition
      ? `${valueProposition} Clearer first run, honest price.`
      : "A clearer first run and an honest price on one page.",
    adHeadline: adHeadline ? `${adHeadline.replace(/\.$/, "")} — try it on your real mess` : "Try it on your real mess",
    adCopy: adCopy || "A short trial on your actual file. No card up front.",
    rationale: `This draft applies “${title}” to the copy. Simulated interest may move; it does not prove anyone will buy. Approve it to clone this idea and rerun on the same personas, or edit the audience first.`,
  };
}
