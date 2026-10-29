/**
 * Best-effort recovery of a JSON object from model output: code fences, leading prose,
 * trailing commas, smart quotes. Returns undefined when nothing parseable is found.
 */
export function extractJson(raw: string): unknown {
  const candidates = new Set<string>();
  const trimmed = raw.trim();
  candidates.add(trimmed);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.add(fenced[1].trim());

  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start !== -1 && end > start) candidates.add(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    for (const text of [candidate, repairJsonText(candidate)]) {
      try {
        return JSON.parse(text);
      } catch {
        // try the next variant
      }
    }
  }
  return undefined;
}

export function repairJsonText(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/^\uFEFF/, "");
}

/** Rough token estimate for logging when the provider doesn't report usage (mock mode). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
