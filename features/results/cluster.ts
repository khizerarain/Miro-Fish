import { normalizePhrase, pct } from "./compute";
import type { CompactReaction, ThemeMap } from "./schemas";

export type ClusterStat = {
  key: string;
  label: string;
  count: number;
  pct: number;
  quotes: string[];
  segments: { key: string; count: number }[];
  phrases: { text: string; count: number }[];
};

/** Apply an LLM theme map onto filtered rows. Counts are computed in code. */
export function clusterThemes(
  rows: CompactReaction[],
  themes: ThemeMap[],
  pick: (r: CompactReaction) => string[],
  quote: (r: CompactReaction) => string,
): ClusterStat[] {
  const n = rows.length || 1;
  const index = new Map<string, ThemeMap>();
  for (const t of themes) {
    for (const p of t.phrases) index.set(normalizePhrase(p), t);
  }

  const buckets = new Map<
    string,
    {
      theme: ThemeMap;
      personas: Set<string>;
      quotes: string[];
      segments: Map<string, number>;
      phrases: Map<string, number>;
    }
  >();

  const other: ThemeMap = { key: "other", label: "Other", phrases: [] };

  for (const r of rows) {
    const hit = new Set<string>();
    for (const raw of pick(r)) {
      const key = normalizePhrase(raw);
      if (!key) continue;
      const theme = index.get(key) ?? other;
      if (hit.has(theme.key)) {
        const b = buckets.get(theme.key);
        if (b) b.phrases.set(key, (b.phrases.get(key) ?? 0) + 1);
        continue;
      }
      hit.add(theme.key);
      const cur = buckets.get(theme.key) ?? {
        theme,
        personas: new Set<string>(),
        quotes: [],
        segments: new Map<string, number>(),
        phrases: new Map<string, number>(),
      };
      cur.personas.add(r.personaId);
      if (cur.quotes.length < 4) cur.quotes.push(quote(r));
      cur.segments.set(r.segmentKey, (cur.segments.get(r.segmentKey) ?? 0) + 1);
      cur.phrases.set(key, (cur.phrases.get(key) ?? 0) + 1);
      buckets.set(theme.key, cur);
    }
  }

  return [...buckets.values()]
    .map((b) => ({
      key: b.theme.key,
      label: b.theme.label,
      count: b.personas.size,
      pct: pct(b.personas.size, n),
      quotes: b.quotes,
      segments: [...b.segments.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, c) => c.count - a.count),
      phrases: [...b.phrases.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, c) => c.count - a.count)
        .slice(0, 8),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Unique phrases (already counted) for the LLM to name. */
export function topPhrasesForLlm(stats: { text: string; count: number }[], take = 24) {
  return stats.slice(0, take).map((p) => ({ phrase: p.text, count: p.count }));
}
