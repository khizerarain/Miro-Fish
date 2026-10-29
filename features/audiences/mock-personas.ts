import { pick, pickN, rngFor } from "@/lib/seeded-rng";
import { DEFAULT_INTERESTS, FINANCIAL, FIRST_NAMES, LAST_NAMES, TRAITS } from "./catalog";
import type { GeneratePersonasVars } from "@/prompts/generate-personas.v1";
import type { PersonaLlm, PersonaSkeleton } from "./schemas";

const STYLES = ["impulse", "researcher", "social", "habitual"] as const;
const SENS = ["low", "medium", "high"] as const;

const NEEDS = [
  "Something that takes less time than the current workaround",
  "A tool that does not need a training session",
  "Clear pricing with no surprise add-ons",
  "To look competent in front of a client or boss",
  "A way to stop forgetting the tedious step",
];
const PAINS = [
  "Already paying for three tools that overlap",
  "Tried a similar app and abandoned it after a week",
  "Doesn't trust a new company with this kind of data",
  "Has no budget until the next quarter",
  "The last vendor overpromised and under-delivered",
];
const ALTS = ["a spreadsheet", "a free template", "the incumbent tool at work", "doing it by hand", "asking a colleague"];

function nameFor(ordinal: number) {
  const first = FIRST_NAMES[ordinal % FIRST_NAMES.length]!;
  const last = LAST_NAMES[ordinal % LAST_NAMES.length]!;
  const cycle = Math.floor(ordinal / (FIRST_NAMES.length * LAST_NAMES.length));
  return cycle ? `${first} ${last} ${cycle + 1}` : `${first} ${last}`;
}

export function mockPersonaBatch(vars: GeneratePersonasVars, skeletons: PersonaSkeleton[]): PersonaLlm[] {
  return skeletons.map((sk) => {
    const rng = rngFor(sk.ordinal + 99, sk.segmentKey, vars.industry);
    const name = nameFor(sk.ordinal);
    const first = name.split(" ")[0]!;
    const trait = pickN(rng, TRAITS, 3);
    const style = pick(rng, STYLES);
    const sensitivity = style === "researcher" ? "high" : pick(rng, SENS);
    const opener = [
      `${first} keeps a ${pick(rng, ["notebook", "notes app", "spreadsheet", "wall calendar"])} by the kettle.`,
      `On most Tuesdays ${first} is already behind before lunch.`,
      `${first} still uses ${pick(rng, ALTS)} and is not looking to switch.`,
    ];
    const backstory = `${pick(rng, opener)} ${pick(rng, FINANCIAL)} They heard about tools like this from ${pick(rng, ["a coworker", "a newsletter", "a sibling", "nobody in particular"])} and would need a clear reason to change.`;
    return {
      ordinal: sk.ordinal,
      name,
      financialSituation: pick(rng, FINANCIAL),
      personalityTraits: trait,
      interests: [...(sk.interestSeeds ?? []), ...pickN(rng, DEFAULT_INTERESTS, 1)].slice(0, 5),
      needs: pickN(rng, NEEDS, 2),
      painPoints: pickN(rng, PAINS, 2),
      currentAlternatives: pickN(rng, ALTS, 2),
      buyingBehavior: { style, priceSensitivity: sensitivity },
      backstory,
    };
  });
}
