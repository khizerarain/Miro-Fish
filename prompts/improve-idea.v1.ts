import type { PromptTemplate } from "./types";

export type ImproveIdeaVars = {
  recommendationJson: string;
  ideaJson: string;
  jsonSchema: string;
};

export const improveIdeaV1: PromptTemplate<ImproveIdeaVars> = {
  id: "improve-idea",
  version: "v1",
  maxTokens: 1600,
  temperature: 0.4,
  system: `You draft a concrete edit to a product idea based on a simulated-research recommendation.

Rules:
- This is a hypothesis, not a promise. Never say the change "will convert" or "proves demand".
- Keep the product recognizable. Change copy, pricing phrasing, or value proposition — not the entire business.
- description: full replacement of the founder-facing description (not a diff).
- adHeadline / adCopy / valueProposition: replacements when they should change, else copy the original.
- rationale: 2–4 sentences the founder can approve, tied to the recommendation.
- Return JSON matching the schema. No markdown.`,
  render: (v) => `Draft an edit the founder can approve.

<recommendation>
${v.recommendationJson}
</recommendation>

<current_idea>
${v.ideaJson}
</current_idea>

JSON schema:
${v.jsonSchema}`,
};
