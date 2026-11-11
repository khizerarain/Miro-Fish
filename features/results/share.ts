import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

function secret() {
  return env().AUTH_SECRET ?? "miro-fish-share-dev-only";
}

function sig(experimentId: string) {
  return createHmac("sha256", secret()).update(experimentId).digest("base64url").slice(0, 24);
}

export function makeShareToken(experimentId: string) {
  return `${experimentId}.${sig(experimentId)}`;
}

export function parseShareToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const got = token.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !got) return null;
  const expected = sig(id);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}
