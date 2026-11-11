import { z } from "zod";

/** What the LLM is allowed to conclude about a diff. */
export const changeBriefSchema = z.object({
  customerVisible: z.boolean(),
  featureSummary: z.string().trim().min(10).max(400),
  customerFacingChange: z.string().trim().min(10).max(300),
  watchPoints: z.array(z.string().trim().min(6).max(200)).max(4),
  confidence: z.enum(["high", "medium", "low"]),
  /** Short label used in the comment, e.g. "Pricing change", "New onboarding step". */
  changeType: z.enum([
    "new_feature",
    "improvement",
    "bug_fix",
    "pricing",
    "copy",
    "onboarding",
    "performance",
    "internal_only",
    "unclear",
  ]),
});

export type ChangeBrief = z.infer<typeof changeBriefSchema>;

export const CHANGE_TYPE_LABELS: Record<ChangeBrief["changeType"], string> = {
  new_feature: "New feature",
  improvement: "Improvement",
  bug_fix: "Bug fix",
  pricing: "Pricing change",
  copy: "Copy change",
  onboarding: "Onboarding change",
  performance: "Performance change",
  internal_only: "Internal only",
  unclear: "Unclear from the diff",
};

/** Deterministic brief used when MOCK_LLM=true or when the diff is empty. */
export function mockChangeBrief(input: { title: string; body: string; files: string[] }): ChangeBrief {
  const internal = input.files.length > 0 && input.files.every(isInternalPath);
  const title = input.title.trim() || "Untitled change";
  if (internal || input.files.length === 0) {
    return {
      customerVisible: false,
      featureSummary: `This pull request (${title}) only touches internal files, so there is nothing new for a customer to react to.`,
      customerFacingChange: "No customer-facing change detected.",
      watchPoints: [],
      confidence: input.files.length === 0 ? "low" : "high",
      changeType: "internal_only",
    };
  }
  const visible = input.files.filter((f) => !isInternalPath(f)).slice(0, 3);
  return {
    customerVisible: true,
    featureSummary: `Mock brief for "${title}": the change touches ${visible.join(", ")}.`,
    customerFacingChange: `Customers would see the result of "${title}" in the product.`,
    watchPoints: ["Unclear how much extra work this asks of me", "I would want to know if my data moves"],
    confidence: "medium",
    changeType: /price|billing|plan|checkout/i.test(title) ? "pricing" : /copy|wording|text/i.test(title) ? "copy" : "improvement",
  };
}

/** Paths that never represent a customer-visible change. */
export function isInternalPath(path: string) {
  return (
    /^(\.github|\.vscode|\.cursor|\.husky)\//.test(path) ||
    /(^|\/)(__tests__|__mocks__|tests?|e2e|fixtures?|specs?)\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(^|\/)(node_modules|dist|build|\.next|coverage)\//.test(path) ||
    /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|\.gitignore|\.gitattributes|\.prettierrc.*|\.eslintrc.*|AGENTS\.md)$/.test(
      path,
    ) ||
    /\.(md|mdx)$/.test(path)
  );
}
