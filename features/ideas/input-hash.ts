import { createHash } from "node:crypto";
import type { IdeaInput } from "./schemas";

/** Fingerprint of the inputs that affect analysis. `url` is excluded; only the text read from it matters. */
export function inputHash(input: IdeaInput): string {
  const relevant = {
    title: input.title.trim(),
    description: input.description.trim(),
    urlExtract: input.urlExtract.trim(),
    pricing: input.pricing,
    adHeadline: input.adHeadline.trim(),
    adCopy: input.adCopy.trim(),
    adChannel: input.adChannel,
    adImage: input.adImageUrl ? createHash("sha256").update(input.adImageUrl).digest("hex") : null,
  };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex").slice(0, 32);
}
