"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { ensureSupabaseUserRow } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken } from "@/lib/auth/session-token";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { env } from "@/lib/env";
import { type AuthFormState, logInSchema, signUpSchema } from "./schemas";

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function fieldErrors(error: z.ZodError): AuthFormState["fieldErrors"] {
  const out: AuthFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof NonNullable<AuthFormState["fieldErrors"]>;
    out[key] ??= issue.message;
  }
  return out;
}

async function setLocalSession(userId: string) {
  const token = await signSessionToken(userId, env().AUTH_SECRET!);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData);
  const values = { name: String(raw.name ?? ""), email: String(raw.email ?? "") };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { name, email, password } = parsed.data;

  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return { error: error.message, values };
    if (!data.session) return { notice: "Check your inbox to confirm your email, then log in.", values };
    if (data.user) await ensureSupabaseUserRow(data.user);
    redirect(safeNext(formData.get("next")));
  }

  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { fieldErrors: { email: "An account with this email already exists" }, values };

  const [user] = await db
    .insert(users)
    .values({ email, name, authProvider: "local", passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  await setLocalSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData);
  const values = { email: String(raw.email ?? "") };
  const parsed = logInSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { email, password } = parsed.data;
  const invalid = { error: "That email and password don't match an account.", values };

  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return invalid;
    await ensureSupabaseUserRow(data.user);
    redirect(safeNext(formData.get("next")));
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return invalid;
  await setLocalSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logOut() {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else {
    (await cookies()).delete(SESSION_COOKIE);
  }
  redirect("/login");
}
