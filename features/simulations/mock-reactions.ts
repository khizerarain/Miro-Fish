import { pick, randInt, rngFor } from "@/lib/seeded-rng";
import type { CompactPersona, ReactionLlm, VariantContent } from "./schemas";

const IGNORE = [
  "I would scroll past this. It does not sound like something I asked for.",
  "Looks like another tool I would forget to open after the free week.",
  "Fine for someone else. I already have a way to handle this.",
];
const SKEPTIC = [
  "The pitch is tidy, which makes me wonder what they are not saying.",
  "I have been burned by a similar promise. I would need proof, not adjectives.",
  "Interesting problem, unconvincing fix. I would keep my current workaround.",
];
const MILD = [
  "I get what they are doing. I would bookmark it and not think about it for a month.",
  "Might help on a busy week. I would not rearrange my stack for it.",
  "Clear enough. I would compare it against what I already pay for.",
];
const WARM = [
  "This is closer to my actual mess than most pitches I see.",
  "I would try a trial if it did not demand a card on day one.",
  "The problem is right. I would want to see it handle my worst Tuesday.",
];

const OBJECTIONS = [
  "I do not want another login in the pile",
  "Switching would take a weekend I do not have",
  "Unclear what happens to my data if they shut down",
  "Price is a conversation with someone else",
  "I already pay for overlapping software",
  "Sounds like it needs a champion at work I am not",
  "The ad oversells a modest feature",
  "I would need it on my phone and they have not shown that",
];
const WANTS = ["a dead-simple first run", "export that I control", "honest pricing on one page", "it working with what I already use"];
const MISSING = ["a real example with my kind of mess", "offline use", "someone human to ask", "a way out if it is wrong"];
const CONVINCE = [
  "A case study from someone in my job, not a startup.",
  "A 15-minute trial that uses my real file, not a demo.",
  "A price I can expense without a meeting.",
  "Nothing this week. Ask me again after the quarter.",
];

function band(rng: () => number, persona: CompactPersona): number {
  let roll = rng();
  if (persona.priceSensitivity === "high") roll = Math.min(1, roll + 0.12);
  if (persona.buyingStyle === "researcher") roll = Math.min(1, roll + 0.08);
  if (persona.buyingStyle === "impulse") roll = Math.max(0, roll - 0.1);
  if (roll < 0.24) return randInt(rng, 2, 18);
  if (roll < 0.5) return randInt(rng, 19, 38);
  if (roll < 0.74) return randInt(rng, 39, 56);
  if (roll < 0.91) return randInt(rng, 57, 73);
  return randInt(rng, 74, 91);
}

function intentFor(score: number): ReactionLlm["purchaseIntent"] {
  if (score < 22) return "none";
  if (score < 48) return "low";
  if (score < 72) return "medium";
  return "high";
}

function priceFor(
  score: number,
  persona: CompactPersona,
  listed: number | null,
  rng: () => number,
): { reaction: ReactionLlm["priceReaction"]; wtp: number | null } {
  if (listed == null) {
    const wtp = Math.round((8 + score * 0.4) * (persona.priceSensitivity === "low" ? 1.4 : 0.8));
    return { reaction: score < 40 ? "expensive" : "fair", wtp };
  }
  const stretch = persona.priceSensitivity === "high" ? 0.55 : persona.priceSensitivity === "low" ? 1.15 : 0.85;
  const wtp = Math.round(listed * stretch * (0.7 + rng() * 0.5));
  if (wtp < listed * 0.45) return { reaction: "unaffordable", wtp };
  if (wtp < listed * 0.85) return { reaction: "expensive", wtp };
  if (wtp > listed * 1.4 && score > 70) return { reaction: "too_cheap", wtp };
  return { reaction: "fair", wtp };
}

export function mockReactionBatch(
  personas: CompactPersona[],
  product: VariantContent,
  seed: number,
): ReactionLlm[] {
  return personas.map((p) => {
    const rng = rngFor(seed, p.ordinal, p.segmentKey, product.summary.slice(0, 24));
    const score = band(rng, p);
    const voice = score < 22 ? IGNORE : score < 48 ? SKEPTIC : score < 72 ? MILD : WARM;
    const intent = intentFor(score);
    const price = priceFor(score, p, product.listedPrice, rng);
    const rec = score >= 76 && intent === "high" && rng() > 0.45;
    const objections = pickNUnique(rng, OBJECTIONS, score < 40 ? 3 : 2).map((text, i) => ({ rank: i + 1, text }));
    return {
      ordinal: p.ordinal,
      firstImpression: `${p.name.split(" ")[0]} here — ${pick(rng, voice)}`,
      interestScore: score,
      purchaseIntent: intent,
      willingnessToPay: price.wtp,
      priceReaction: price.reaction,
      topObjections: objections,
      wantedFeatures: score < 25 ? [] : pickNUnique(rng, WANTS, 2),
      missingFeatures: pickNUnique(rng, MISSING, score < 40 ? 2 : 1),
      whatWouldConvinceThem: pick(rng, CONVINCE),
      wouldRecommend: rec,
      recommendReason: rec
        ? "I would mention it to a colleague who already has the same headache."
        : "I would not vouch for something I have not used through a bad week.",
    };
  });
}

function pickNUnique(rng: () => number, items: readonly string[], n: number): string[] {
  const copy = [...items];
  const out: string[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

export function fallbackReaction(persona: CompactPersona): ReactionLlm {
  return {
    ordinal: persona.ordinal,
    firstImpression: `${persona.name.split(" ")[0]} would need another look. The pitch did not stick this time.`,
    interestScore: 18,
    purchaseIntent: "none",
    willingnessToPay: null,
    priceReaction: "expensive",
    topObjections: [{ rank: 1, text: "Could not get a clear read, so I would not act" }],
    wantedFeatures: [],
    missingFeatures: ["a plainer explanation of what I actually get"],
    whatWouldConvinceThem: "A short, specific demo. Not another slogan.",
    wouldRecommend: false,
    recommendReason: "I do not recommend tools I bounced off of.",
  };
}
