import { rngFor, pick, pickN, randInt, seededShuffle } from "@/lib/seeded-rng";
import { incomeFromAge, PROFESSIONS, REGION_PLACES } from "./catalog";
import { INCOME_BANDS, INTEREST_OPTIONS, REGIONS, type RegionId } from "./constants";
import {
  enabledSegments,
  segmentCounts,
  type AudienceDefinition,
  type PersonaSkeleton,
} from "./schemas";

const GENDERS = [
  ["woman", 0.47],
  ["man", 0.47],
  ["nonbinary", 0.06],
] as const;

function pickGender(rng: () => number): PersonaSkeleton["gender"] {
  const r = rng();
  let acc = 0;
  for (const [g, w] of GENDERS) {
    acc += w;
    if (r < acc) return g;
  }
  return "woman";
}

function regionsFor(def: AudienceDefinition): RegionId[] {
  return def.filters.regions.length ? def.filters.regions : REGIONS.map((r) => r.id);
}

function incomesFor(def: AudienceDefinition): AudienceDefinition["filters"]["incomeBands"] {
  return def.filters.incomeBands.length ? def.filters.incomeBands : INCOME_BANDS.map((b) => b.id);
}

/** Deterministic skeleton for one ordinal. Same seed + definition + ordinal = same demographics. */
export function skeletonFor(
  seed: number,
  ordinal: number,
  def: AudienceDefinition,
  size: number,
  segmentKey = allocateSegmentKeys(seed, def, size)[ordinal]!,
): PersonaSkeleton {
  const rng = rngFor(seed, ordinal, "demo");
  const age = randInt(rng, def.filters.ageMin, def.filters.ageMax);
  const region = pick(rng, regionsFor(def));
  const allowedIncome = incomesFor(def);
  let income = incomeFromAge(age, rng());
  if (!allowedIncome.includes(income)) income = pick(rng, allowedIncome);
  const profession = def.filters.professions.length ? pick(rng, def.filters.professions) : pick(rng, PROFESSIONS);
  const interestPool = def.filters.interests.length ? def.filters.interests : [...INTEREST_OPTIONS];
  return {
    ordinal,
    segmentKey,
    age,
    gender: pickGender(rng),
    region,
    location: pick(rng, REGION_PLACES[region]),
    profession,
    incomeBand: income,
    techComfort: randInt(rng, def.filters.techMin, def.filters.techMax),
    interestSeeds: pickN(rng, interestPool, randInt(rng, 2, 4)),
  };
}

export function allocateSegmentKeys(seed: number, def: AudienceDefinition, size: number): string[] {
  const segs = enabledSegments(def);
  const counts = segmentCounts(def, size);
  const keys: string[] = [];
  for (const s of segs) {
    const n = counts[s.key] ?? 0;
    for (let i = 0; i < n; i++) keys.push(s.key);
  }
  while (keys.length < size) keys.push(segs[0]!.key);
  return seededShuffle(keys, seed).slice(0, size);
}

export function allSkeletons(seed: number, def: AudienceDefinition, size: number): PersonaSkeleton[] {
  const keys = allocateSegmentKeys(seed, def, size);
  return keys.map((segmentKey, i) => skeletonFor(seed, i, def, size, segmentKey));
}
