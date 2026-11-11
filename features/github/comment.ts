import type { DashboardStats } from "@/features/results/compute";
import type { NarrativePayload } from "@/features/results/schemas";
import { CHANGE_TYPE_LABELS, type ChangeBrief } from "./brief";

/** Marker so we can find and update our own comment instead of stacking new ones. */
export const COMMENT_MARKER = "<!-- miro-fish:simulated-customer-reaction -->";

export type CommentInput = {
  brief: ChangeBrief;
  stats: DashboardStats;
  narrative: NarrativePayload | null;
  audienceName: string;
  audienceSize: number;
  experimentHref: string;
  simulated: boolean;
  truncated: boolean;
};

const pctOf = (n: number, whole: number) => (whole > 0 ? Math.round((n / whole) * 100) : 0);

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** Objection phrases are stored normalized (lowercase) for grouping; re-read them for display. */
function asSentence(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Renders the PR comment. Pure: no I/O, so it can be tested and reused by the UI. */
export function renderComment(input: CommentInput): string {
  const { brief, stats, narrative, audienceName, audienceSize, experimentHref, simulated, truncated } = input;
  const n = stats.n;
  const lines: string[] = [];

  lines.push(COMMENT_MARKER);
  lines.push(`### Simulated customer reaction`);
  lines.push("");
  lines.push(
    `> **Simulated results — not user research.** These are AI personas reacting to a description of this PR, ` +
      `not real customers. Treat them as hypotheses to validate before relying on them.`,
  );
  lines.push("");

  if (simulated) {
    lines.push(`**What customers were shown** (${CHANGE_TYPE_LABELS[brief.changeType]}): ${brief.featureSummary}`);
    lines.push("");
    lines.push(`_Customer-facing change:_ ${brief.customerFacingChange}`);
    if (truncated) {
      lines.push("");
      lines.push(`_The diff was too large to review in full, so this brief may be incomplete._`);
    }
    lines.push("");
  } else {
    lines.push(`**What customers were shown:** ${brief.featureSummary}`);
    lines.push("");
  }

  // --- Computed numbers, always from stored reactions ---
  const mean = stats.meanInterest == null ? "—" : stats.meanInterest.toFixed(1);
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Mean simulated interest (0–100) | **${mean}** |`);
  lines.push(`| Median simulated interest | ${stats.medianInterest ?? "—"} |`);
  lines.push(`| Interested (\u2265 60) | ${stats.interested} / ${n} (${pctOf(stats.interested, n)}%) |`);
  lines.push(`| Indifferent or ignoring (< 25) | ${stats.ignoring} / ${n} (${pctOf(stats.ignoring, n)}%) |`);
  lines.push(`| Would recommend | ${stats.recommendYes} / ${n} (${stats.recommendPct}%) |`);
  lines.push(
    `| Purchase intent (none / low / med / high) | ${stats.byIntent.none} / ${stats.byIntent.low} / ${stats.byIntent.medium} / ${stats.byIntent.high} |`,
  );
  lines.push("");
  const extrapolatedNote =
    stats.extrapolated > 0
      ? ` ${stats.extrapolated.toLocaleString("en-US")} of ${n.toLocaleString("en-US")} reactions were extrapolated from similar personas in the same segment.`
      : "";
  lines.push(
    `_${plural(n, "persona")} from **${audienceName}** (a population of ${audienceSize.toLocaleString("en-US")}) evaluated this change.${
      extrapolatedNote
    } Counts computed from stored reactions; the narrative below is generated around them._`,
  );
  lines.push("");

  if (narrative) {
    lines.push(`#### Headline hypotheses`);
    for (const h of narrative.headlines) lines.push(`- ${h.text} _(based on ${h.evidence})_`);
    lines.push("");

    if (stats.objections.length) {
      lines.push(`#### Likely objections`);
      for (const o of stats.objections.slice(0, 4)) {
        lines.push(`- ${asSentence(o.text)} — ${o.count} of ${n} personas (${o.pct}%)`);
      }
      lines.push("");
    }

    if (narrative.pricingTakeaway) {
      lines.push(`#### Pricing read`);
      lines.push(narrative.pricingTakeaway);
      lines.push("");
    }

    if (narrative.recommendations.length) {
      lines.push(`#### Suggested next steps`);
      for (const r of narrative.recommendations.slice(0, 3)) {
        lines.push(`- **${r.title}** (${r.impact} impact, ${r.effort} effort) — ${r.detail}`);
      }
      lines.push("");
    }
  } else if (narrative === null) {
    lines.push(`_Narrative notes are still generating. The numbers above are already final._`);
    lines.push("");
  }

  if (brief.watchPoints.length) {
    lines.push(
      `<details><summary>What this run assumed about the change</summary>\n\n` +
        brief.watchPoints.map((w) => `- ${w}`).join("\n") +
        `\n\n</details>`,
    );
    lines.push("");
  }

  const quotes = stats.confusedQuotes.slice(0, 2);
  if (quotes.length) {
    lines.push(`#### Voices from the simulated population`);
    // Personas sometimes share a phrase; showing it twice reads like a bug.
    const seen = new Set<string>();
    for (const q of quotes) {
      const key = q.text.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`> ${q.text}\n>\n> — ${q.name}, simulated persona (interest ${q.score}/100)`);
    }
    lines.push("");
  }

  lines.push(`#### How to validate this`);
  const validation = narrative?.validation;
  lines.push(
    validation
      ? validation.interviews.slice(0, 2).map((q) => `- Ask real users: ${q}`).join("\n")
      : `- Show this change to 5 real users and ask what they would expect to be different.\n- Watch support tickets and drop-off in the week after release.`,
  );
  lines.push("");
  lines.push(
    `[Open the full dashboard](${experimentHref}) · \`${stats.simulated}\` simulated · \`${stats.extrapolated}\` extrapolated · Miro Fish`,
  );

  return lines.join("\n");
}

/** Compact summary for the check run. Never blocks a merge. */
export function renderCheckSummary(input: CommentInput): string {
  const { stats, brief, audienceName } = input;
  const mean = stats.meanInterest == null ? "—" : stats.meanInterest.toFixed(1);
  return [
    `**Simulated customer reaction** (hypothesis, not user research)`,
    ``,
    `Mean simulated interest **${mean}/100** across ${stats.n.toLocaleString("en-US")} personas from "${audienceName}".`,
    `Interested ${stats.interested} · indifferent/ignoring ${stats.ignoring} · would recommend ${stats.recommendYes}.`,
    ``,
    `Change reviewed: ${brief.customerFacingChange}`,
  ].join("\n");
}

/** Used when a PR has no customer-visible change, so we say nothing rather than something misleading. */
export function renderSkippedSummary(brief: ChangeBrief): string {
  return [
    `**No customer-visible change detected.**`,
    ``,
    brief.featureSummary,
    ``,
    `Nothing was simulated. Miro Fish only reviews changes a customer could notice.`,
  ].join("\n");
}
