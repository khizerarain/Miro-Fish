export const AGE_BUCKETS = ["18–24", "25–34", "35–44", "45–54", "55+"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export const SENTIMENT_BANDS = [
  { id: "ignore", label: "Ignoring", min: 0, max: 24 },
  { id: "cool", label: "Cool", min: 25, max: 44 },
  { id: "mixed", label: "Mixed", min: 45, max: 64 },
  { id: "warm", label: "Warm", min: 65, max: 79 },
  { id: "hot", label: "Hot", min: 80, max: 100 },
] as const;
export type SentimentBandId = (typeof SENTIMENT_BANDS)[number]["id"];

export const IMPACT = ["high", "medium", "low"] as const;
export const EFFORT = ["high", "medium", "low"] as const;
