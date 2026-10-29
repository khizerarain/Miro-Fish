export const AUDIENCE_SIZES = [100, 500, 1000, 5000] as const;
export type AudienceSize = (typeof AUDIENCE_SIZES)[number];

/** Personas per LLM call. Architecture: 25–50. */
export const PERSONA_BATCH_SIZE = 30;

export const REGIONS = [
  { id: "us_west", label: "US West" },
  { id: "us_midwest", label: "US Midwest" },
  { id: "us_south", label: "US South" },
  { id: "us_northeast", label: "US Northeast" },
  { id: "uk", label: "United Kingdom" },
  { id: "ca", label: "Canada" },
  { id: "eu", label: "EU" },
  { id: "au", label: "Australia" },
  { id: "latam", label: "Latin America" },
  { id: "asia", label: "South and East Asia" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export const INCOME_BANDS = [
  { id: "under_40k", label: "Under $40k" },
  { id: "40_75k", label: "$40k–$75k" },
  { id: "75_120k", label: "$75k–$120k" },
  { id: "120_200k", label: "$120k–$200k" },
  { id: "200k_plus", label: "$200k+" },
] as const;

export type IncomeBandId = (typeof INCOME_BANDS)[number]["id"];

export const INTEREST_OPTIONS = [
  "productivity",
  "finance",
  "health",
  "family",
  "travel",
  "food",
  "sports",
  "gaming",
  "design",
  "education",
  "sustainability",
  "music",
] as const;
