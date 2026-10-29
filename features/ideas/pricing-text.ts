import { hasPricing, type Pricing } from "./schemas";

const MODEL_LABEL: Record<Pricing["model"], string> = {
  subscription: "Subscription",
  one_time: "One-time purchase",
  freemium: "Freemium",
  usage_based: "Usage-based",
  free: "Free",
};
const PERIOD_LABEL: Record<Pricing["plans"][number]["period"], string> = {
  month: "/month",
  year: "/year",
  one_time: " one-time",
  usage: " per unit",
};

/** Plain-text rendering of structured pricing for prompts. Empty string when nothing was entered. */
export function pricingToText(p: Pricing): string {
  if (p.model === "free") return `Model: Free${p.notes ? `\nNotes: ${p.notes}` : ""}`;
  if (!hasPricing(p) && !p.notes.trim()) return "";
  const plans = p.plans
    .filter((plan) => plan.name.trim() || plan.price !== null)
    .map((plan) => {
      const price = plan.price === null ? "price not set" : `${plan.price} ${p.currency}${PERIOD_LABEL[plan.period]}`;
      return `- ${plan.name.trim() || "Unnamed plan"}: ${price}${plan.features.trim() ? `. Includes: ${plan.features.trim()}` : ""}`;
    });
  return [`Model: ${MODEL_LABEL[p.model]}`, ...plans, p.notes.trim() ? `Notes: ${p.notes.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
}
