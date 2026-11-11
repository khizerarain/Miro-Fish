import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies GitHub's `X-Hub-Signature-256` header against the raw request body.
 * Must run on the unparsed body: parsing first changes the bytes and the digest fails.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const prefix = "sha256=";
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length), "hex");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Non-cryptographic short hash, used to group identical PR head states. */
export function shortHash(input: string): string {
  return createHmac("sha256", "miro-fish").update(input).digest("hex").slice(0, 12);
}
