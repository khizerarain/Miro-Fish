import type { PersonaLlm, PersonaProfile, PersonaSkeleton } from "./schemas";
import { personaProfileSchema } from "./schemas";

export const firstWords = (s: string, n = 6) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n)
    .join(" ");

export function mergePersona(sk: PersonaSkeleton, llm: PersonaLlm, usedNames: Set<string>, usedOpeners: Set<string>): PersonaProfile {
  let name = llm.name.trim();
  let key = name.toLowerCase();
  if (!name || usedNames.has(key)) {
    name = `${name || "Persona"} ${sk.ordinal + 1}`;
    key = name.toLowerCase();
  }
  usedNames.add(key);

  let backstory = llm.backstory.trim();
  const opener = firstWords(backstory);
  if (usedOpeners.has(opener)) backstory = `${sk.location.split(",")[0]} resident. ${backstory}`;
  usedOpeners.add(firstWords(backstory));

  return personaProfileSchema.parse({
    ...llm,
    name,
    backstory,
    ordinal: sk.ordinal,
    age: sk.age,
    gender: sk.gender,
    location: sk.location,
    region: sk.region,
    profession: sk.profession,
    incomeBand: sk.incomeBand,
    techComfort: sk.techComfort,
    segmentKey: sk.segmentKey,
  });
}
