import { personaProfileSchema } from "@/features/audiences/schemas";
import type { CompactPersona } from "./schemas";

export function compactPersona(row: {
  id: string;
  ordinal: number;
  name: string;
  age: number;
  gender: string | null;
  location: string | null;
  profession: string | null;
  incomeBand: string | null;
  techComfort: number | null;
  segmentKey: string;
  profile: unknown;
}): CompactPersona {
  const p = personaProfileSchema.safeParse(row.profile);
  return {
    id: row.id,
    ordinal: row.ordinal,
    name: row.name,
    age: row.age,
    gender: row.gender,
    location: row.location,
    profession: row.profession,
    incomeBand: row.incomeBand,
    techComfort: row.techComfort,
    segmentKey: row.segmentKey,
    traits: p.success ? p.data.personalityTraits : [],
    needs: p.success ? p.data.needs : [],
    painPoints: p.success ? p.data.painPoints : [],
    alternatives: p.success ? p.data.currentAlternatives : [],
    buyingStyle: p.success ? p.data.buyingBehavior.style : "researcher",
    priceSensitivity: p.success ? p.data.buyingBehavior.priceSensitivity : "high",
    financial: p.success ? p.data.financialSituation : "",
  };
}
