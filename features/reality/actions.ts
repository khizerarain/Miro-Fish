"use server";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { realityImports } from "@/db/schema";
import { computeDashboard } from "@/features/results/compute";
import { getExperimentForUser, loadCompactReactions } from "@/features/results/queries";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { parseCsv, parseNotes } from "./parse";
import type { RealityCompare } from "./schemas";

type Fail = { ok: false; error: string };

export async function importReality(
  experimentId: string,
  filename: string,
  text: string,
): Promise<{ ok: true; compare: RealityCompare } | Fail> {
  const user = await requireUser();
  try {
    enforceRateLimit(user.id, "reality-import", 8, 60_000);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment is gone." };
  const kind = filename.toLowerCase().endsWith(".csv") || text.includes(",") ? "csv" : "notes";
  const rows = kind === "csv" ? parseCsv(text) : parseNotes(text);
  if (!rows.length) return { ok: false, error: "Could not read scores, objections, or quotes from that file." };

  const simulated = computeDashboard(await loadCompactReactions(exp.id));
  const scores = rows.map((r) => r.interest).filter((n): n is number => n != null);
  const importedMean = scores.length ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10 : null;
  const importedObj = new Map<string, number>();
  for (const r of rows) {
    const t = (r.objection ?? "").trim().toLowerCase();
    if (t.length >= 4) importedObj.set(t, (importedObj.get(t) ?? 0) + 1);
  }
  const overlap = simulated.objections.slice(0, 8).map((o) => ({
    text: o.text,
    simulated: o.count,
    imported: importedObj.get(o.text.toLowerCase()) ?? 0,
  }));

  const compare: RealityCompare = {
    importedN: rows.length,
    importedMean,
    simulatedN: simulated.n,
    simulatedMean: simulated.meanInterest,
    meanDelta: importedMean != null && simulated.meanInterest != null ? Math.round((importedMean - simulated.meanInterest) * 10) / 10 : null,
    objectionOverlap: overlap,
    caution:
      "This is a directional check against your imported notes, not validation. Simulated interest is still a hypothesis. Use the overlap to pick interview questions.",
  };

  const db = await getDb();
  await db.insert(realityImports).values({
    ownerId: user.id,
    experimentId: exp.id,
    filename: filename.slice(0, 180) || "paste.txt",
    kind,
    rowCount: rows.length,
    payload: { rows: rows.slice(0, 400), compare },
  });
  track("reality_imported", { experimentId: exp.id, n: rows.length, kind });
  return { ok: true, compare };
}

export async function loadLatestReality(experimentId: string) {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false as const, error: "Unknown experiment." };
  const db = await getDb();
  const [row] = await db
    .select()
    .from(realityImports)
    .where(eq(realityImports.experimentId, exp.id))
    .orderBy(desc(realityImports.createdAt))
    .limit(1);
  const compare = row?.payload && typeof row.payload === "object" && "compare" in (row.payload as object)
    ? ((row.payload as { compare: RealityCompare }).compare ?? null)
    : null;
  return { ok: true as const, compare, filename: row?.filename ?? null };
}
