import { INCOME_BANDS } from "@/features/audiences/constants";
import type { PurchaseIntent, PriceReaction } from "@/features/simulations/schemas";
import { AGE_BUCKETS, SENTIMENT_BANDS, type AgeBucket, type SentimentBandId } from "./constants";
import type { CompactReaction, DashboardFilters } from "./schemas";

export function ageBucket(age: number): AgeBucket {
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  return "55+";
}

export function sentimentBand(score: number): SentimentBandId {
  for (const b of SENTIMENT_BANDS) {
    if (score >= b.min && score <= b.max) return b.id;
  }
  return "mixed";
}

export function isIgnoring(row: CompactReaction) {
  return row.interestScore < 25;
}

export function isHostile(row: CompactReaction) {
  return row.purchaseIntent === "none" && row.interestScore < 40;
}

export function isInterested(row: CompactReaction) {
  return row.interestScore >= 60;
}

export function applyFilters(rows: CompactReaction[], f: DashboardFilters): CompactReaction[] {
  return rows.filter((r) => {
    if (f.segment !== "all" && r.segmentKey !== f.segment) return false;
    if (f.age !== "all" && ageBucket(r.age) !== f.age) return false;
    if (f.income !== "all" && (r.incomeBand ?? "") !== f.income) return false;
    if (f.intent !== "all" && r.purchaseIntent !== f.intent) return false;
    return true;
  });
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((s, n) => s + n, 0) / values.length) * 10) / 10;
}

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round(((s[mid - 1]! + s[mid]!) / 2) * 10) / 10;
}

const emptyIntent = (): Record<PurchaseIntent, number> => ({ none: 0, low: 0, medium: 0, high: 0 });
const emptyPrice = (): Record<PriceReaction, number> => ({
  too_cheap: 0,
  fair: 0,
  expensive: 0,
  unaffordable: 0,
});

export type SegmentStat = {
  key: string;
  n: number;
  meanInterest: number | null;
  interested: number;
  ignoring: number;
  hostile: number;
  interestedPct: number;
  ignoringPct: number;
  hostilePct: number;
  byPrice: Record<PriceReaction, number>;
};

export type PhraseStat = {
  text: string;
  count: number;
  pct: number;
  quotes: string[];
  segments: string[];
};

export type DashboardStats = {
  n: number;
  simulated: number;
  extrapolated: number;
  meanInterest: number | null;
  medianInterest: number | null;
  byIntent: Record<PurchaseIntent, number>;
  intentPct: Record<PurchaseIntent, number>;
  byPrice: Record<PriceReaction, number>;
  pricePct: Record<PriceReaction, number>;
  recommendYes: number;
  recommendPct: number;
  interested: number;
  ignoring: number;
  hostile: number;
  bySegment: SegmentStat[];
  byAge: { bucket: AgeBucket; n: number; meanInterest: number | null }[];
  byIncome: { id: string; n: number; meanInterest: number | null }[];
  sentiment: { id: SentimentBandId; label: string; n: number; pct: number }[];
  wtp: {
    values: number[];
    mean: number | null;
    median: number | null;
    histogram: { label: string; min: number; max: number; n: number }[];
  };
  objections: PhraseStat[];
  wanted: PhraseStat[];
  missing: PhraseStat[];
  resonatedQuotes: { personaId: string; variantId: string; name: string; text: string; score: number }[];
  confusedQuotes: { personaId: string; variantId: string; name: string; text: string; score: number }[];
};

export function computeDashboard(rows: CompactReaction[], segmentLabels: Record<string, string> = {}): DashboardStats {
  const n = rows.length;
  const scores = rows.map((r) => r.interestScore);
  const byIntent = emptyIntent();
  const byPrice = emptyPrice();
  let simulated = 0;
  let extrapolated = 0;
  let recommendYes = 0;
  let interested = 0;
  let ignoring = 0;
  let hostile = 0;
  const wtpValues: number[] = [];

  const seg = new Map<string, CompactReaction[]>();
  const ageMap = new Map<AgeBucket, number[]>();
  const incomeMap = new Map<string, number[]>();
  const sentCounts: Record<SentimentBandId, number> = { ignore: 0, cool: 0, mixed: 0, warm: 0, hot: 0 };

  for (const r of rows) {
    if (r.isExtrapolated) extrapolated++;
    else simulated++;
    byIntent[r.purchaseIntent]++;
    if (r.priceReaction) byPrice[r.priceReaction]++;
    if (r.wouldRecommend) recommendYes++;
    if (isInterested(r)) interested++;
    if (isIgnoring(r)) ignoring++;
    if (isHostile(r)) hostile++;
    if (r.willingnessToPay != null && Number.isFinite(r.willingnessToPay)) wtpValues.push(r.willingnessToPay);
    sentCounts[sentimentBand(r.interestScore)]++;
    const sl = seg.get(r.segmentKey) ?? [];
    sl.push(r);
    seg.set(r.segmentKey, sl);
    const ab = ageBucket(r.age);
    ageMap.set(ab, [...(ageMap.get(ab) ?? []), r.interestScore]);
    if (r.incomeBand) incomeMap.set(r.incomeBand, [...(incomeMap.get(r.incomeBand) ?? []), r.interestScore]);
  }

  const bySegment: SegmentStat[] = [...seg.entries()]
    .map(([key, list]) => {
      const interestedN = list.filter(isInterested).length;
      const ignoringN = list.filter(isIgnoring).length;
      const hostileN = list.filter(isHostile).length;
      const price = emptyPrice();
      for (const r of list) {
        if (r.priceReaction) price[r.priceReaction]++;
      }
      return {
        key,
        n: list.length,
        meanInterest: mean(list.map((r) => r.interestScore)),
        interested: interestedN,
        ignoring: ignoringN,
        hostile: hostileN,
        interestedPct: pct(interestedN, list.length),
        ignoringPct: pct(ignoringN, list.length),
        hostilePct: pct(hostileN, list.length),
        byPrice: price,
      };
    })
    .sort((a, b) => (b.meanInterest ?? 0) - (a.meanInterest ?? 0));

  void segmentLabels;

  return {
    n,
    simulated,
    extrapolated,
    meanInterest: mean(scores),
    medianInterest: median(scores),
    byIntent,
    intentPct: {
      none: pct(byIntent.none, n),
      low: pct(byIntent.low, n),
      medium: pct(byIntent.medium, n),
      high: pct(byIntent.high, n),
    },
    byPrice,
    pricePct: {
      too_cheap: pct(byPrice.too_cheap, n),
      fair: pct(byPrice.fair, n),
      expensive: pct(byPrice.expensive, n),
      unaffordable: pct(byPrice.unaffordable, n),
    },
    recommendYes,
    recommendPct: pct(recommendYes, n),
    interested,
    ignoring,
    hostile,
    bySegment,
    byAge: AGE_BUCKETS.map((bucket) => ({
      bucket,
      n: ageMap.get(bucket)?.length ?? 0,
      meanInterest: mean(ageMap.get(bucket) ?? []),
    })),
    byIncome: INCOME_BANDS.map((b) => ({
      id: b.id,
      n: incomeMap.get(b.id)?.length ?? 0,
      meanInterest: mean(incomeMap.get(b.id) ?? []),
    })),
    sentiment: SENTIMENT_BANDS.map((b) => ({
      id: b.id,
      label: b.label,
      n: sentCounts[b.id],
      pct: pct(sentCounts[b.id], n),
    })),
    wtp: {
      values: wtpValues,
      mean: mean(wtpValues),
      median: median(wtpValues),
      histogram: wtpHistogram(wtpValues),
    },
    objections: phraseStats(rows, (r) => r.objections, (r) => r.firstImpression),
    wanted: phraseStats(rows, (r) => r.wantedFeatures, (r) => r.whatWouldConvinceThem),
    missing: phraseStats(rows, (r) => r.missingFeatures, (r) => r.whatWouldConvinceThem),
    resonatedQuotes: rows
      .filter((r) => r.interestScore >= 65)
      .sort((a, b) => b.interestScore - a.interestScore)
      .slice(0, 6)
      .map((r) => ({
        personaId: r.personaId,
        variantId: r.variantId,
        name: r.personaName,
        text: r.firstImpression,
        score: r.interestScore,
      })),
    confusedQuotes: rows
      .filter((r) => r.interestScore < 40)
      .sort((a, b) => a.interestScore - b.interestScore)
      .slice(0, 6)
      .map((r) => ({
        personaId: r.personaId,
        variantId: r.variantId,
        name: r.personaName,
        text: r.firstImpression,
        score: r.interestScore,
      })),
  };
}

function phraseStats(
  rows: CompactReaction[],
  pick: (r: CompactReaction) => string[],
  quote: (r: CompactReaction) => string,
): PhraseStat[] {
  const n = rows.length || 1;
  const map = new Map<string, { count: number; quotes: string[]; segments: Set<string> }>();
  for (const r of rows) {
    const seen = new Set<string>();
    for (const raw of pick(r)) {
      const text = raw.trim();
      if (!text) continue;
      const key = normalizePhrase(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const cur = map.get(key) ?? { count: 0, quotes: [], segments: new Set() };
      cur.count++;
      if (cur.quotes.length < 3) cur.quotes.push(quote(r));
      cur.segments.add(r.segmentKey);
      map.set(key, cur);
    }
  }
  return [...map.entries()]
    .map(([text, v]) => ({
      text,
      count: v.count,
      pct: pct(v.count, n),
      quotes: v.quotes,
      segments: [...v.segments],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

export function normalizePhrase(text: string) {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9$%+\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wtpHistogram(values: number[]) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const step = max <= 20 ? 5 : max <= 80 ? 10 : max <= 200 ? 25 : 50;
  const last = Math.floor(max / step);
  const buckets = Array.from({ length: last + 1 }, (_, i) => {
    const min = i * step;
    const end = min + step;
    return { label: `$${min}–${end}`, min, max: end, n: 0 };
  });
  for (const v of values) {
    const i = Math.min(buckets.length - 1, Math.floor(v / step));
    buckets[i]!.n++;
  }
  return buckets;
}
