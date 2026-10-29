import type { AnalyzeIdeaVars } from "@/prompts/analyze-idea.v1";
import type { Analysis } from "./schemas";

type Profile = {
  keywords: RegExp;
  industry: string;
  category: string;
  markets: Analysis["targetMarkets"];
  competitors: Analysis["likelyCompetitors"];
  assumption: string;
};

const PROFILES: Profile[] = [
  {
    keywords: /\b(invoice|invoicing|accounting|bookkeep|expense|payroll|tax|budget|finance|bank)/i,
    industry: "Financial software",
    category: "Small business finance tool",
    markets: [
      { segment: "Freelancers and solo consultants", rationale: "Handle their own admin and feel the pain directly." },
      {
        segment: "Small agencies (2–20 people)",
        rationale: "Outgrowing spreadsheets but not ready for an accountant-run stack.",
      },
    ],
    competitors: [
      { name: "QuickBooks", whyRelevant: "Default choice for small business accounting." },
      { name: "FreshBooks", whyRelevant: "Popular with freelancers for invoicing." },
      { name: "Spreadsheets", whyRelevant: "Free and already familiar to most of the audience." },
    ],
    assumption: "Users trust a new tool with financial data enough to connect accounts.",
  },
  {
    keywords: /\b(fitness|workout|gym|health|nutrition|diet|meditat|sleep|wellness|habit)/i,
    industry: "Health and wellness",
    category: "Consumer wellness app",
    markets: [
      { segment: "Busy professionals 25–45", rationale: "Want results but have little time to plan." },
      {
        segment: "Beginners restarting a routine",
        rationale: "Need structure and encouragement more than advanced features.",
      },
    ],
    competitors: [
      { name: "Strava", whyRelevant: "Strong habit loop for active users." },
      { name: "MyFitnessPal", whyRelevant: "Well-known tracking app." },
      { name: "Free YouTube content", whyRelevant: "Zero-cost alternative many people already use." },
    ],
    assumption: "Users keep using it after the first two weeks, when most wellness apps lose people.",
  },
  {
    keywords: /\b(learn|course|student|teacher|tutor|school|education|lesson|study)/i,
    industry: "Education",
    category: "Learning platform",
    markets: [
      { segment: "Adult self-learners", rationale: "Pay for outcomes like a new skill or a promotion." },
      { segment: "Parents of school-age children", rationale: "Buy on behalf of their kids and care about progress." },
    ],
    competitors: [
      { name: "Coursera", whyRelevant: "Large catalog with credentials." },
      { name: "Duolingo", whyRelevant: "Sets expectations for gamified, free learning." },
    ],
    assumption: "Learners will pay rather than use free alternatives.",
  },
  {
    keywords: /\b(restaurant|food|meal|recipe|coffee|bakery|grocery|delivery|kitchen|snack)/i,
    industry: "Food and beverage",
    category: "Food product or service",
    markets: [
      { segment: "Urban households", rationale: "Value convenience and try new options." },
      { segment: "Health-conscious eaters", rationale: "Pay more for quality and transparency." },
    ],
    competitors: [
      { name: "DoorDash / Uber Eats", whyRelevant: "Default for convenience food." },
      { name: "Local grocery stores", whyRelevant: "Cheaper, familiar alternative." },
    ],
    assumption: "Customers reorder often enough to justify acquisition costs.",
  },
  {
    keywords: /\b(shop|store|ecommerce|e-commerce|fashion|apparel|clothing|jewelry|marketplace)/i,
    industry: "Retail and e-commerce",
    category: "Direct-to-consumer brand",
    markets: [
      { segment: "Online shoppers 18–34", rationale: "Discover brands on social media and buy on mobile." },
      { segment: "Gift buyers", rationale: "Look for something distinctive at a clear price." },
    ],
    competitors: [
      { name: "Amazon", whyRelevant: "Sets expectations on price and delivery speed." },
      { name: "Etsy sellers", whyRelevant: "Offer similar distinctive products." },
    ],
    assumption: "The product stands out enough to justify a price above mass-market options.",
  },
];

const DEFAULT_PROFILE: Profile = {
  keywords: /./,
  industry: "Software",
  category: "SaaS tool",
  markets: [
    { segment: "Small and mid-size teams", rationale: "Feel the problem but lack dedicated tooling." },
    { segment: "Early adopters in tech", rationale: "Comfortable trying new tools and giving feedback." },
  ],
  competitors: [
    { name: "Existing all-in-one suites", whyRelevant: "Teams often stretch tools they already pay for." },
    { name: "Manual workarounds", whyRelevant: "Spreadsheets, docs, and email cost nothing extra." },
  ],
  assumption: "The problem is painful enough that teams will change their current workflow.",
};

function sentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n|•|- /)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 200);
}

function clip(text: string, max: number) {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Deterministic stand-in for the analyze-idea prompt. Shapes output from the actual inputs. */
export function mockAnalyzeIdea(v: AnalyzeIdeaVars): Analysis {
  const corpus = [v.title, v.description, v.urlExtract, v.adHeadline, v.adCopy].join("\n");
  const profile = PROFILES.find((p) => p.keywords.test(corpus)) ?? DEFAULT_PROFILE;
  const lines = sentences([v.description, v.urlExtract, v.adCopy].join("\n"));
  const name = v.title.trim() || "This product";

  const featureLines = lines.filter((s) =>
    /\b(lets|helps|track|automat|sync|send|create|build|manage|plan|connect|get|with)\b/i.test(s),
  );
  const keyFeatures = (featureLines.length ? featureLines : lines)
    .slice(0, 4)
    .map((s) => clip(s.replace(/[.!?]$/, ""), 160));
  if (keyFeatures.length === 0) keyFeatures.push("Core functionality described in the submission");

  const valueSource = v.adHeadline.trim() || lines[0] || `${name} helps its users solve a specific problem.`;
  const hasPricing = v.pricing.trim().length > 0;

  return {
    summary: clip(`${name}: ${lines[0] ?? valueSource}`, 240),
    industry: profile.industry,
    category: profile.category,
    targetMarkets: profile.markets,
    valueProposition: clip(valueSource, 500),
    keyFeatures,
    pricingSummary: hasPricing ? clip(v.pricing.replace(/\n+/g, "; "), 400) : "No pricing provided.",
    likelyCompetitors: profile.competitors,
    keyAssumptions: [
      { assumption: profile.assumption, risk: "high" },
      {
        assumption: hasPricing
          ? "The stated price feels fair to the core segment relative to what they use today."
          : "The target audience is willing to pay for this at all.",
        risk: "high",
      },
      {
        assumption: `The audience can be reached affordably through ${v.adChannel || "the channels you plan to use"}.`,
        risk: "medium",
      },
      { assumption: "The main benefit is clear within a few seconds of seeing the offer.", risk: "medium" },
    ],
    uncertainties: [
      ...(hasPricing ? [] : ["No pricing was given, so willingness to pay is open."]),
      ...(v.urlExtract ? [] : ["No website was provided, so positioning is based on the description only."]),
      "Mock mode: this analysis was generated without an AI model.",
    ].slice(0, 4),
  };
}
