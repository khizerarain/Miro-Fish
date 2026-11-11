import type { DashboardStats } from "./compute";
import type { AnalyzeResults } from "./schemas";

function takePhrases(list: { text: string; count: number }[], n: number) {
  return list.slice(0, n).map((p) => p.text);
}

function padNotes(fromQuotes: string[], a: string, b: string) {
  const out = [...fromQuotes];
  if (out.length < 1) out.push(a);
  if (out.length < 2) out.push(b);
  return out.slice(0, 5);
}

function bucket(phrases: string[], key: string, label: string, from: number, to: number) {
  const slice = phrases.slice(from, to);
  return { key, label, phrases: slice.length ? slice : [label.toLowerCase()] };
}

/** Deterministic notes around already-computed stats. Never invents counts. */
export function mockAnalyzeResults(stats: DashboardStats, productHint: string): AnalyzeResults {
  const obj = takePhrases(stats.objections, 18);
  const feat = takePhrases([...stats.wanted, ...stats.missing], 18);
  const topSeg = stats.bySegment[0];
  const ignoreSeg = [...stats.bySegment].sort((a, b) => b.ignoringPct - a.ignoringPct)[0];
  const mean = stats.meanInterest ?? 0;
  const expensive = stats.pricePct.expensive + stats.pricePct.unaffordable;
  const hint = productHint.slice(0, 40) || "this idea";

  return {
    headlines: [
      {
        text: `Mean simulated interest is ${mean}. That is a directional read of this crowd, not a forecast.`,
        evidence: `meanInterest ${mean} from ${stats.n} stored reactions`,
      },
      {
        text: topSeg
          ? `${topSeg.key} is the most engaged segment in this run (${topSeg.meanInterest ?? "—"} mean simulated interest).`
          : "Segments did not separate much in this run.",
        evidence: topSeg ? `segment ${topSeg.key} n=${topSeg.n}` : "no segments",
      },
      {
        text:
          expensive >= 40
            ? `${expensive}% of stored reactions called the price expensive or unaffordable. Treat that as a likely objection to test.`
            : `Purchase intent is mixed: ${stats.intentPct.none}% none, ${stats.intentPct.low}% low, ${stats.intentPct.medium}% medium, ${stats.intentPct.high}% high.`,
        evidence:
          expensive >= 40
            ? `price expensive+unaffordable ${expensive}%`
            : `intent mix none ${stats.byIntent.none} low ${stats.byIntent.low}`,
      },
    ],
    objectionThemes: [
      bucket(obj, "switching_cost", "Switching cost and incumbents", 0, 3),
      bucket(obj, "price_trust", "Price, proof, and trust", 3, 6),
      bucket(obj, "time_effort", "Time and setup effort", 6, 9),
      bucket(obj, "fit_clarity", "Unclear fit", 9, 12),
    ],
    featureThemes: [
      bucket(feat, "first_run", "Dead-simple first run", 0, 3),
      bucket(feat, "control_export", "Control and export", 3, 6),
      bucket(feat, "honest_price", "Plain pricing", 6, 9),
      bucket(feat, "works_with", "Works with what they already use", 9, 12),
    ],
    pricingTakeaway:
      expensive >= 40
        ? `Among stored reactions, ${stats.pricePct.fair}% called the price fair and ${expensive}% called it high or out of reach. Mean simulated willingness to pay is ${stats.wtp.mean ?? "—"}. That is a hypothesis to take into a real pricing survey, not a number to set a plan on.`
        : `Price reactions lean mixed-to-fair (${stats.pricePct.fair}% fair). Mean simulated willingness to pay is ${stats.wtp.mean ?? "—"}. Ask real buyers what they pay today before changing list price.`,
    messaging: {
      resonated: padNotes(
        stats.resonatedQuotes.slice(0, 3).map((q) => q.text),
        `A few people said ${hint} sounded like their actual mess.`,
        "The ones who leaned in wanted a trial that uses a real file, not a demo.",
      ),
      confused: padNotes(
        stats.confusedQuotes.slice(0, 3).map((q) => q.text),
        "Several people said they would scroll past; the pitch did not name their job.",
        "Low-score reactions asked what happens to their data if this shuts down.",
      ),
    },
    recommendations: [
      {
        title: "Interview the ignoring segment first",
        detail: ignoreSeg
          ? `${ignoreSeg.key} had ${ignoreSeg.ignoringPct}% ignoring in this run. Ask five real people in that job why they would not open a tool like this.`
          : "Ask five people who already have a workaround why they would not switch.",
        impact: "high",
        effort: "medium",
        evidence: ignoreSeg ? `segment ${ignoreSeg.key} ignoring ${ignoreSeg.ignoring}` : "ignoring count",
      },
      {
        title: "Put one concrete proof on the page",
        detail:
          "The likely objection in this crowd is vague claims. Replace adjectives with a 15-minute path using a real file.",
        impact: "high",
        effort: "medium",
        evidence: `top objection ${stats.objections[0]?.text ?? "none"} (${stats.objections[0]?.count ?? 0})`,
      },
      {
        title: "Test price with the same plan names",
        detail: `Run a short survey using your actual plan names. ${stats.pricePct.expensive}% of stored reactions called the listed price expensive.`,
        impact: "medium",
        effort: "low",
        evidence: `price expensive ${stats.byPrice.expensive} of ${stats.n}`,
      },
      {
        title: "Show the missing first-run",
        detail:
          stats.wanted[0]
            ? `Wanted most: “${stats.wanted[0].text}”. Ship a thin version of that before adding more surface area.`
            : "Ship a thinner first run before adding more surface area.",
        impact: "medium",
        effort: "high",
        evidence: stats.wanted[0] ? `wanted “${stats.wanted[0].text}” n=${stats.wanted[0].count}` : "wanted features",
      },
    ],
    validation: {
      interviews: [
        "Walk me through the last time this problem wasted an afternoon. What did you actually do?",
        topSeg
          ? `For people like ${topSeg.key}: if I described ${hint} in one sentence, what would you ask next?`
          : "If I described this in one sentence, what would you ask next?",
        "What would have to be true for you to drop the tool you use today?",
        "Where would you expect to see the price? What number would make you close the tab?",
      ],
      surveys: [
        "Which of these objections sounds most like you? (switching cost, price, trust, time, unclear fit)",
        "At this monthly price, would you call it too cheap, fair, expensive, or not for you?",
        "Which missing piece would change your mind: a real example, export you control, or a human to ask?",
        "Would you mention this to a colleague this month? Why or why not?",
      ],
    },
  };
}
