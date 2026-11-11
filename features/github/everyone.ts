import type { AudienceDefinition } from "@/features/audiences/schemas";

export const EVERYONE_AUDIENCE_NAME = "Everyone";
export const EVERYONE_AUDIENCE_SIZE = 100;
/** Fixed so every repo that reviews "as everyone" gets the same demographics and comparable reruns. */
export const EVERYONE_AUDIENCE_SEED = 20261111;

/**
 * A broad, mixed audience for repos that want "everyone" rather than a target market.
 * The weights are a hand-picked spread for review, not census data.
 */
export const EVERYONE_DEFINITION: AudienceDefinition = {
  segments: [
    {
      key: "mainstream",
      label: "Mainstream users",
      rationale: "Use apps like this occasionally, compare a couple of options, no strong loyalty.",
      weight: 30,
      enabled: true,
      custom: false,
    },
    {
      key: "budget-conscious",
      label: "Budget-conscious",
      rationale: "Price, hidden fees and subscriptions decide; quick to walk away.",
      weight: 25,
      enabled: true,
      custom: false,
    },
    {
      key: "time-poor",
      label: "Busy and time-poor",
      rationale: "Skim everything, abandon anything that adds steps or friction.",
      weight: 20,
      enabled: true,
      custom: false,
    },
    {
      key: "late-adopters",
      label: "Late adopters",
      rationale: "Low tech comfort, wary of change, need things to be obvious and trustworthy.",
      weight: 15,
      enabled: true,
      custom: false,
    },
    {
      key: "early-adopters",
      label: "Early adopters",
      rationale: "Try new things first, notice details, switch tools easily.",
      weight: 10,
      enabled: true,
      custom: false,
    },
  ],
  filters: {
    ageMin: 18,
    ageMax: 80,
    regions: [],
    incomeBands: [],
    professions: [],
    techMin: 1,
    techMax: 5,
    interests: [],
  },
};
