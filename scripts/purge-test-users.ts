import { inArray, like } from "drizzle-orm";
import type { getDb } from "../db";
import { githubInstallations, users } from "../db/schema";

/**
 * Removes accounts left behind by earlier verify runs that crashed before their own cleanup.
 * Installations only `set null` on owner delete, so they have to go first.
 */
export async function purgeTestUsers(db: Awaited<ReturnType<typeof getDb>>, emailPrefix: string) {
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${emailPrefix}%@example.test`));
  if (stale.length === 0) return 0;
  const ids = stale.map((u) => u.id);
  await db.delete(githubInstallations).where(inArray(githubInstallations.ownerId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  return stale.length;
}
