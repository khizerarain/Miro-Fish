import { importedRowSchema, type ImportedRow } from "./schemas";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function norm(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const INTEREST = new Set(["interest", "interestscore", "score", "nps", "rating"]);
const INTENT = new Set(["intent", "purchaseintent", "wouldbuy"]);
const OBJECTION = new Set(["objection", "objections", "concern", "whyNot"]);
const QUOTE = new Set(["quote", "comment", "notes", "feedback", "text"]);
const SEGMENT = new Set(["segment", "audience", "persona"]);

export function parseCsv(text: string): ImportedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return parseNotes(text);
  const header = splitCsvLine(lines[0]!).map(norm);
  const idx = {
    interest: header.findIndex((h) => INTEREST.has(h)),
    intent: header.findIndex((h) => INTENT.has(h)),
    objection: header.findIndex((h) => OBJECTION.has(h) || h === "whynot"),
    quote: header.findIndex((h) => QUOTE.has(h)),
    segment: header.findIndex((h) => SEGMENT.has(h)),
  };
  if (Object.values(idx).every((i) => i < 0)) return parseNotes(text);
  const rows: ImportedRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const interestRaw = idx.interest >= 0 ? cols[idx.interest] : "";
    const n = interestRaw ? Number(interestRaw) : NaN;
    const parsed = importedRowSchema.safeParse({
      interest: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null,
      intent: idx.intent >= 0 ? cols[idx.intent] || null : null,
      objection: idx.objection >= 0 ? cols[idx.objection] || null : null,
      quote: idx.quote >= 0 ? cols[idx.quote] || null : null,
      segment: idx.segment >= 0 ? cols[idx.segment] || null : null,
    });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows;
}

export function parseNotes(text: string): ImportedRow[] {
  return text
    .split(/\n{2,}|\n[-*]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .slice(0, 200)
    .map((quote) => ({
      interest: null,
      intent: null,
      objection: quote.slice(0, 240),
      quote: quote.slice(0, 600),
      segment: null,
    }));
}
