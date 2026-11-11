"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experiments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertExperimentRoom } from "@/lib/usage";
import { cloneAudience, cloneExperiment, cloneIdea } from "./clone";
import { getExperimentForUser } from "@/features/results/queries";
import { revalidatePath } from "next/cache";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();
const nameSchema = z.string().trim().min(1).max(120);

export async function renameExperiment(experimentId: string, name: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Give this run a short name." };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment is gone." };
  const db = await getDb();
  await db.update(experiments).set({ name: parsed.data }).where(eq(experiments.id, experimentId));
  revalidatePath("/experiments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveExperiment(experimentId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment is gone." };
  const db = await getDb();
  await db.update(experiments).set({ archivedAt: new Date() }).where(eq(experiments.id, experimentId));
  track("experiment_archived", { experimentId });
  revalidatePath("/experiments");
  revalidatePath("/experiments/archived");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return { ok: true };
}

export async function restoreExperiment(experimentId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment is gone." };
  const db = await getDb();
  await db.update(experiments).set({ archivedAt: null }).where(eq(experiments.id, experimentId));
  revalidatePath("/experiments");
  revalidatePath("/experiments/archived");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return { ok: true };
}

export async function duplicateExperiment(experimentId: string): Promise<{ ok: true; experimentId: string } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false, error: "Unknown experiment." };
  try {
    enforceRateLimit(user.id, "duplicate", 10, 60_000);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const room = await assertExperimentRoom(user.id);
  if (room) return { ok: false, error: room };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment is gone." };

  const idea = exp.ideaId ? await cloneIdea(exp.ideaId, user.id) : null;
  const audience = exp.audienceId ? await cloneAudience(exp.audienceId, user.id) : null;
  const copy = await cloneExperiment({
    sourceId: exp.id,
    ownerId: user.id,
    name: `${exp.name} copy`,
    ideaId: idea?.id ?? null,
    audienceId: audience?.id ?? null,
    changeSummary: `Duplicated from “${exp.name}”.`,
    status: audience?.status === "ready" ? "draft" : "draft",
  });
  if (!copy) return { ok: false, error: "Could not duplicate this run." };
  if (idea) {
    const db = await getDb();
    await db.update(experiments).set({ ideaId: idea.id }).where(eq(experiments.id, copy.id));
  }
  track("experiment_duplicated", { experimentId: copy.id, parent: exp.id });
  revalidatePath("/experiments");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return { ok: true, experimentId: copy.id };
}
