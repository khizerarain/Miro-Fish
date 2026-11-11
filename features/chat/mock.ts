import type { ChatPersonaVars } from "@/prompts/chat-persona.v1";
import { rngFor, pick } from "@/lib/seeded-rng";
import type { ChatReply } from "./schemas";

const DODGE = [
  "I would still scroll past. The chat does not change what I saw on the page.",
  "I already have a workaround. Talking it through does not make me switch this week.",
  "Maybe someone else. I would not spend my Tuesday proving this out.",
];
const WARMER = [
  "That is closer to what I actually need. I would still want to see it on my own mess first.",
  "If that is real, I might try a short trial. I would not pay up front.",
  "Better. I would still compare it against what I already pay for.",
];
const STILL_NO = [
  "A nicer pitch does not fix the switching cost. I would stay put.",
  "I have heard that promise. I would need proof from someone in my job, not another sentence.",
  "Price and trust are still the issue. This does not move me.",
];

export function mockChatReply(vars: ChatPersonaVars): ChatReply {
  const rng = rngFor(vars.userMessage.length, vars.personaXml.slice(0, 40), vars.mode);
  const lowOriginal = /"interestScore":\s*([0-9]+)/.exec(vars.originalReactionJson);
  const original = lowOriginal ? Number(lowOriginal[1]) : 32;
  const pitch = vars.userMessage.toLowerCase();
  const sweet =
    /free|trial|cheaper|lower price|case study|my files|export|no card|proof|demo/.test(pitch);

  if (vars.mode === "convince") {
    const bump = sweet ? 8 + Math.floor(rng() * 10) : Math.floor(rng() * 5) - 2;
    const score = Math.max(4, Math.min(78, original + bump));
    const intent = score < 22 ? "none" : score < 48 ? "low" : score < 72 ? "medium" : "high";
    const reply = score < original + 4 ? pick(rng, STILL_NO) : pick(rng, WARMER);
    return {
      reply: `${reply} I would not call this a decision to buy.`,
      updatedIntent: intent,
      updatedScore: score,
      notableQuote: reply,
    };
  }

  if (/why didn't you buy|why didn.t you buy/.test(pitch)) {
    const reply = original < 40
      ? "I did not buy because it did not look like my problem, and I already have a way to get through the week."
      : "I was curious, not convinced. Switching would take a weekend I do not have.";
    return { reply, updatedIntent: null, updatedScore: null, notableQuote: reply };
  }
  if (/change your mind/.test(pitch)) {
    const reply =
      "A 15-minute trial on my real file, a price I can expense, and a case from someone in my job. Slogans would not.";
    return { reply, updatedIntent: null, updatedScore: null, notableQuote: reply };
  }
  if (/use today/.test(pitch)) {
    const reply =
      "Spreadsheets, the last tool my last job paid for, and asking a colleague. Ugly, but it is mine.";
    return { reply, updatedIntent: null, updatedScore: null, notableQuote: reply };
  }

  return {
    reply: pick(rng, DODGE),
    updatedIntent: null,
    updatedScore: null,
    notableQuote: null,
  };
}
