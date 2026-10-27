import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";
import { createSupabaseServerClient } from "./supabase-server";

export type SessionUser = { id: string; email: string; name: string | null };

const toSessionUser = (u: typeof users.$inferSelect): SessionUser => ({ id: u.id, email: u.email, name: u.name });

/** Finds or creates the app's user row for a Supabase auth user. */
export async function ensureSupabaseUserRow(authUser: {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
}) {
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.externalAuthId, authUser.id)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({
      email: (authUser.email ?? `${authUser.id}@unknown`).toLowerCase(),
      name: authUser.user_metadata?.name ?? null,
      authProvider: "supabase",
      externalAuthId: authUser.id,
    })
    .returning();
  return created;
}

/** Current user or null. Deduplicated per request. Reads cookies, so callers must sit behind <Suspense>. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Read the request first so prerendering stops here, before touching env or the database.
  const cookieStore = await cookies();
  const e = env();

  if (e.AUTH_PROVIDER === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return toSessionUser(await ensureSupabaseUserRow(data.user));
  }

  const userId = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, e.AUTH_SECRET!);
  if (!userId) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ? toSessionUser(user) : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
