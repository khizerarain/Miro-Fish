import { computeDashboard, type DashboardStats } from "@/features/results/compute";
import type { CompactReaction } from "@/features/results/schemas";
import type { PurchaseIntent, PriceReaction } from "@/features/simulations/schemas";

const SMALL_MEAN_DELTA = 3;
const SCORE_SD = 18;

export type VariantPack = {
  id: string;
  label: string;
  isControl: boolean;
  n: number;
  meanInterest: number | null;
  intentPct: Record<PurchaseIntent, number>;
  pricePct: Record<PriceReaction, number>;
  interestedPct: number;
  expensivePct: number;
  objections: { text: string; count: number; pct: number }[];
  bySegment: { key: string; label: string; n: number; meanInterest: number | null }[];
};

export type ComparisonNumbers = {
  variants: VariantPack[];
  controlId: string | null;
  deltas: {
    variantId: string;
    label: string;
    meanDelta: number | null;
    interestedPctDelta: number | null;
    expensivePctDelta: number | null;
    se: number | null;
    uncertain: boolean;
  }[];
  segmentWinners: {
    key: string;
    label: string;
    winnerLabel: string;
    loserLabel: string;
    spread: number;
  }[];
  objectionDiffs: { text: string; byLabel: Record<string, number> }[];
  priceDiffs: { reaction: PriceReaction; byLabel: Record<string, number> }[];
  smallDifference: boolean;
  uncertaintyNote: string | null;
};

export function packVariant(
  id: string,
  label: string,
  isControl: boolean,
  rows: CompactReaction[],
  segmentLabels: Record<string, string>,
): VariantPack {
  const stats = computeDashboard(rows, segmentLabels);
  return {
    id,
    label,
    isControl,
    n: stats.n,
    meanInterest: stats.meanInterest,
    intentPct: stats.intentPct,
    pricePct: stats.pricePct,
    interestedPct: stats.n ? Math.round((stats.interested / stats.n) * 1000) / 10 : 0,
    expensivePct: stats.pricePct.expensive + stats.pricePct.unaffordable,
    objections: stats.objections.slice(0, 8).map((o) => ({ text: o.text, count: o.count, pct: o.pct })),
    bySegment: stats.bySegment.map((s) => ({
      key: s.key,
      label: segmentLabels[s.key] ?? s.key,
      n: s.n,
      meanInterest: s.meanInterest,
    })),
  };
}

export function computeComparison(packs: VariantPack[]): ComparisonNumbers {
  const ready = packs.filter((p) => p.n > 0);
  const control = ready.find((p) => p.isControl) ?? ready[0] ?? null;
  const deltas = ready
    .filter((p) => p.id !== control?.id)
    .map((p) => {
      const meanDelta =
        p.meanInterest != null && control?.meanInterest != null
          ? round1(p.meanInterest - control.meanInterest)
          : null;
      const n1 = control?.n ?? 0;
      const n2 = p.n;
      const se = n1 > 1 && n2 > 1 ? round1(SCORE_SD * Math.sqrt(1 / n1 + 1 / n2)) : null;
      const uncertain =
        meanDelta == null ||
        Math.abs(meanDelta) < SMALL_MEAN_DELTA ||
        (se != null && Math.abs(meanDelta) < 1.96 * se);
      return {
        variantId: p.id,
        label: p.label,
        meanDelta,
        interestedPctDelta: round1(p.interestedPct - (control?.interestedPct ?? 0)),
        expensivePctDelta: round1(p.expensivePct - (control?.expensivePct ?? 0)),
        se,
        uncertain,
      };
    });

  const keys = new Set(ready.flatMap((p) => p.bySegment.map((s) => s.key)));
  const segmentWinners = [...keys]
    .map((key) => {
      const scored = ready
        .map((p) => {
          const s = p.bySegment.find((x) => x.key === key);
          return { label: p.label, mean: s?.meanInterest ?? null, labelText: s?.label ?? key };
        })
        .filter((x) => x.mean != null) as { label: string; mean: number; labelText: string }[];
      if (scored.length < 2) return null;
      const sorted = [...scored].sort((a, b) => b.mean - a.mean);
      const spread = round1(sorted[0]!.mean - sorted[sorted.length - 1]!.mean);
      return {
        key,
        label: scored[0]!.labelText,
        winnerLabel: sorted[0]!.label,
        loserLabel: sorted[sorted.length - 1]!.label,
        spread,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null && x.spread >= 1)
    .sort((a, b) => b.spread - a.spread);

  const phrases = new Set(ready.flatMap((p) => p.objections.map((o) => o.text)));
  const objectionDiffs = [...phrases]
    .map((text) => ({
      text,
      byLabel: Object.fromEntries(ready.map((p) => [p.label, p.objections.find((o) => o.text === text)?.pct ?? 0])),
    }))
    .filter((row) => {
      const vals = Object.values(row.byLabel);
      return Math.max(...vals) - Math.min(...vals) >= 4;
    })
    .slice(0, 8);

  const priceKeys: PriceReaction[] = ["too_cheap", "fair", "expensive", "unaffordable"];
  const priceDiffs = priceKeys.map((reaction) => ({
    reaction,
    byLabel: Object.fromEntries(ready.map((p) => [p.label, p.pricePct[reaction]])),
  }));

  const smallDifference = deltas.length === 0 || deltas.every((d) => d.uncertain);
  const uncertaintyNote = smallDifference
    ? "Simulated interest gaps are small or within a rough error band. Treat ranking as a hypothesis, not a winner."
    : null;

  return {
    variants: ready,
    controlId: control?.id ?? null,
    deltas,
    segmentWinners,
    objectionDiffs,
    priceDiffs,
    smallDifference,
    uncertaintyNote,
  };
}

export function statsForLlm(numbers: ComparisonNumbers) {
  return {
    smallDifference: numbers.smallDifference,
    uncertaintyNote: numbers.uncertaintyNote,
    variants: numbers.variants.map((v) => ({
      label: v.label,
      isControl: v.isControl,
      n: v.n,
      meanInterest: v.meanInterest,
      interestedPct: v.interestedPct,
      expensivePct: v.expensivePct,
      intentPct: v.intentPct,
      topObjections: v.objections.slice(0, 5),
      segments: v.bySegment,
    })),
    deltas: numbers.deltas,
    segmentWinners: numbers.segmentWinners.slice(0, 8),
    objectionDiffs: numbers.objectionDiffs,
    priceDiffs: numbers.priceDiffs,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export type { DashboardStats };
