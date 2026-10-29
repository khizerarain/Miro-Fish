import { seededShuffle } from "@/lib/seeded-rng";
import { ANCHOR_CAP } from "./constants";

export function pickAnchorIds(
  personas: { id: string; segmentKey: string; ordinal: number }[],
  seed: number,
  cap = ANCHOR_CAP,
): string[] {
  if (personas.length <= cap) return personas.map((p) => p.id);
  const bySeg = new Map<string, typeof personas>();
  for (const p of personas) {
    const list = bySeg.get(p.segmentKey) ?? [];
    list.push(p);
    bySeg.set(p.segmentKey, list);
  }
  const total = personas.length;
  const picked: string[] = [];
  const leftover: { id: string }[] = [];
  let i = 0;
  for (const [, group] of bySeg) {
    const share = Math.max(1, Math.round((group.length / total) * cap));
    const shuffled = seededShuffle(group, seed + i++);
    picked.push(...shuffled.slice(0, share).map((p) => p.id));
    leftover.push(...shuffled.slice(share));
  }
  if (picked.length > cap) return picked.slice(0, cap);
  const fill = seededShuffle(leftover, seed + 99);
  while (picked.length < cap && fill.length) picked.push(fill.pop()!.id);
  return picked;
}
