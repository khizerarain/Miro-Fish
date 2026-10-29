import { personaProfileSchema, type PersonaProfile } from "./schemas";

export function profileOf(row: { profile: unknown }): PersonaProfile | null {
  const parsed = personaProfileSchema.safeParse(row.profile);
  if (parsed.success) return parsed.data;
  if (row.profile && typeof row.profile === "object") {
    const raw = row.profile as Record<string, unknown>;
    const coerced = personaProfileSchema.safeParse({
      ...raw,
      age: Number(raw.age),
      techComfort: Number(raw.techComfort),
    });
    if (coerced.success) return coerced.data;
  }
  return null;
}
