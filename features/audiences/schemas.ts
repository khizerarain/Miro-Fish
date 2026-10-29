import { z } from "zod";
import { AUDIENCE_SIZES, INCOME_BANDS, PERSONA_BATCH_SIZE, REGIONS } from "./constants";

const regionIds = REGIONS.map((r) => r.id) as [(typeof REGIONS)[number]["id"], ...(typeof REGIONS)[number]["id"][]];
const incomeIds = INCOME_BANDS.map((b) => b.id) as [
  (typeof INCOME_BANDS)[number]["id"],
  ...(typeof INCOME_BANDS)[number]["id"][],
];

export const segmentSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  rationale: z.string().trim().max(300),
  weight: z.number().min(1).max(100),
  enabled: z.boolean(),
  custom: z.boolean(),
});

export const audienceFiltersSchema = z.object({
  ageMin: z.number().int().min(18).max(80),
  ageMax: z.number().int().min(18).max(80),
  regions: z.array(z.enum(regionIds)),
  incomeBands: z.array(z.enum(incomeIds)),
  professions: z.array(z.string().trim().min(1).max(60)).max(12),
  techMin: z.number().int().min(1).max(5),
  techMax: z.number().int().min(1).max(5),
  interests: z.array(z.string().trim().min(1).max(40)).max(12),
});

export const audienceDefinitionSchema = z
  .object({
    segments: z.array(segmentSchema).min(1).max(8),
    filters: audienceFiltersSchema,
  })
  .refine((d) => d.filters.ageMin <= d.filters.ageMax, { message: "Age range is backwards", path: ["filters", "ageMin"] })
  .refine((d) => d.filters.techMin <= d.filters.techMax, {
    message: "Tech-comfort range is backwards",
    path: ["filters", "techMin"],
  })
  .refine((d) => d.segments.some((s) => s.enabled && s.weight > 0), {
    message: "Turn on at least one segment",
    path: ["segments"],
  });

export const audienceSizeSchema = z.union(AUDIENCE_SIZES.map((n) => z.literal(n)));

export type AudienceSegment = z.infer<typeof segmentSchema>;
export type AudienceFilters = z.infer<typeof audienceFiltersSchema>;
export type AudienceDefinition = z.infer<typeof audienceDefinitionSchema>;
export type AudienceSize = z.infer<typeof audienceSizeSchema>;

export const emptyFilters = (): AudienceFilters => ({
  ageMin: 22,
  ageMax: 58,
  regions: [],
  incomeBands: [],
  professions: [],
  techMin: 2,
  techMax: 5,
  interests: [],
});

export function definitionFromAnalysis(
  markets: { segment: string; rationale: string }[],
): AudienceDefinition {
  const unique = markets.filter((m, i, arr) => arr.findIndex((x) => x.segment === m.segment) === i).slice(0, 6);
  const list = unique.length ? unique : [{ segment: "General audience", rationale: "Broad first look." }];
  const weight = Math.floor(100 / list.length);
  const remainder = 100 - weight * list.length;
  const used = new Set<string>();
  return {
    segments: list.map((m, i) => {
      const base = slug(m.segment);
      let key = base;
      let n = 2;
      while (used.has(key)) key = `${base}-${n++}`;
      used.add(key);
      return {
        key,
        label: m.segment,
        rationale: m.rationale,
        weight: weight + (i === 0 ? remainder : 0),
        enabled: true,
        custom: false,
      };
    }),
    filters: emptyFilters(),
  };
}

export function slug(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "segment"
  );
}

export function enabledSegments(def: AudienceDefinition) {
  return def.segments.filter((s) => s.enabled && s.weight > 0);
}

export function segmentCounts(def: AudienceDefinition, size: number) {
  const segs = enabledSegments(def);
  const totalW = segs.reduce((s, x) => s + x.weight, 0) || 1;
  const raw = segs.map((s) => ({ key: s.key, exact: (size * s.weight) / totalW }));
  const floors = raw.map((r) => ({ key: r.key, n: Math.floor(r.exact), frac: r.exact - Math.floor(r.exact) }));
  let used = floors.reduce((s, x) => s + x.n, 0);
  const byFrac = [...floors].sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (used < size && byFrac.length) {
    floors.find((f) => f.key === byFrac[i % byFrac.length]!.key)!.n++;
    used++;
    i++;
  }
  return Object.fromEntries(floors.map((f) => [f.key, f.n])) as Record<string, number>;
}

export const buyingStyleSchema = z.enum(["impulse", "researcher", "social", "habitual"]);
export const priceSensitivitySchema = z.enum(["low", "medium", "high"]);
export const genderSchema = z.enum(["woman", "man", "nonbinary"]);

const short = (max: number) => z.string().trim().min(1).max(max);

/** LLM-authored fields. Demographics come from the seeded skeleton and must be preserved. */
export const personaLlmSchema = z.object({
  ordinal: z.number().int().min(0),
  name: short(60),
  financialSituation: short(240),
  personalityTraits: z.array(short(40)).min(2).max(6),
  interests: z.array(short(40)).min(1).max(6),
  needs: z.array(short(120)).min(1).max(5),
  painPoints: z.array(short(160)).min(1).max(5),
  currentAlternatives: z.array(short(80)).min(1).max(4),
  buyingBehavior: z.object({
    style: buyingStyleSchema,
    priceSensitivity: priceSensitivitySchema,
  }),
  backstory: z.string().trim().min(40).max(600),
});

export const personaBatchSchema = z.object({
  personas: z.array(personaLlmSchema).min(1).max(PERSONA_BATCH_SIZE),
});

export const personaProfileSchema = personaLlmSchema.extend({
  age: z.number().int().min(18).max(90),
  gender: genderSchema,
  location: short(80),
  region: z.string().min(1),
  profession: short(80),
  incomeBand: z.enum(incomeIds),
  techComfort: z.number().int().min(1).max(5),
  segmentKey: short(80),
});

export type PersonaLlm = z.infer<typeof personaLlmSchema>;
export type PersonaProfile = z.infer<typeof personaProfileSchema>;
export type PersonaSkeleton = {
  ordinal: number;
  segmentKey: string;
  age: number;
  gender: z.infer<typeof genderSchema>;
  location: string;
  region: string;
  profession: string;
  incomeBand: z.infer<typeof personaProfileSchema>["incomeBand"];
  techComfort: number;
  interestSeeds: string[];
};

export const AUDIENCE_STATUSES = ["draft", "generating", "ready", "failed"] as const;
export type AudienceStatus = (typeof AUDIENCE_STATUSES)[number];
