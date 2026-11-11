import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSec: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** In-memory sliding window. Fine for a single Node process (PGlite / one Vercel instance). */
export function enforceRateLimit(userId: string, action: string, max: number, windowMs: number) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (cur.count >= max) {
    throw new RateLimitError("Slow down — too many of these in a short window.", Math.ceil((cur.resetAt - now) / 1000));
  }
  cur.count += 1;
}

export const LIMITS = {
  experimentsActive: 40,
  llmPerMinute: 20,
  jobsPerDay: 80,
} as const;
