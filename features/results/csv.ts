import { INCOME_BANDS } from "@/features/audiences/constants";
import type { CompactReaction } from "./schemas";

const incomeLabel = (id: string | null) => INCOME_BANDS.find((b) => b.id === id)?.label ?? id ?? "";

function cell(v: string | number | boolean | null) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function reactionsToCsv(rows: CompactReaction[], labels: Record<string, string>) {
  const header = [
    "persona",
    "segment",
    "age",
    "income",
    "interest_score",
    "purchase_intent",
    "price_reaction",
    "willingness_to_pay",
    "would_recommend",
    "extrapolated",
    "first_impression",
    "objections",
    "wanted_features",
    "missing_features",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        cell(r.personaName),
        cell(labels[r.segmentKey] ?? r.segmentKey),
        cell(r.age),
        cell(incomeLabel(r.incomeBand)),
        cell(r.interestScore),
        cell(r.purchaseIntent),
        cell(r.priceReaction),
        cell(r.willingnessToPay),
        cell(r.wouldRecommend),
        cell(r.isExtrapolated),
        cell(r.firstImpression),
        cell(r.objections.join(" | ")),
        cell(r.wantedFeatures.join(" | ")),
        cell(r.missingFeatures.join(" | ")),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
