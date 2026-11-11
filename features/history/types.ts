export type RunSnapshot = {
  id: string;
  name: string;
  status: string;
  seed: number;
  changeSummary: string | null;
  parentExperimentId: string | null;
  createdAt: string;
  completedAt: string | null;
  meanInterest: number | null;
  n: number;
  topObjections: { text: string; pct: number }[];
  idea: {
    description: string;
    valueProposition: string;
    adHeadline: string;
    listedPrice: number | null;
  };
};

export function ideaDiff(a: RunSnapshot["idea"], b: RunSnapshot["idea"]) {
  const rows: { field: string; before: string; after: string }[] = [];
  const pair = [
    ["Description", a.description, b.description],
    ["Value proposition", a.valueProposition, b.valueProposition],
    ["Ad headline", a.adHeadline, b.adHeadline],
    ["Listed price", a.listedPrice == null ? "" : String(a.listedPrice), b.listedPrice == null ? "" : String(b.listedPrice)],
  ] as const;
  for (const [field, before, after] of pair) {
    if ((before ?? "").trim() !== (after ?? "").trim()) rows.push({ field, before: before || "—", after: after || "—" });
  }
  return rows;
}
