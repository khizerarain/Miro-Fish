"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { experiments, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { ensureProject, getProjectForUser, listProjectExperiments, listProjects } from "./queries";
import { revalidatePath } from "next/cache";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();
const nameSchema = z.string().trim().min(1).max(80);

export async function createProject(name: string, description?: string): Promise<{ ok: true; id: string } | Fail> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Give the project a short name." };
  try {
    enforceRateLimit(user.id, "create-project", 20, 60_000);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const row = await ensureProject(user.id, parsed.data, description);
  track("project_created", { projectId: row.id });
  revalidatePath("/projects");
  return { ok: true, id: row.id };
}

export async function renameProject(projectId: string, name: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Give the project a short name." };
  const row = await getProjectForUser(user.id, projectId);
  if (!row) return { ok: false, error: "This project is gone." };
  const db = await getDb();
  await db.update(projects).set({ name: parsed.data }).where(eq(projects.id, projectId));
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function archiveProject(projectId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const row = await getProjectForUser(user.id, projectId);
  if (!row) return { ok: false, error: "This project is gone." };
  const db = await getDb();
  await db.update(projects).set({ archivedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function assignExperimentProject(experimentId: string, projectId: string | null): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false, error: "Unknown experiment." };
  const db = await getDb();
  const [exp] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.id, experimentId), eq(experiments.ownerId, user.id)))
    .limit(1);
  if (!exp) return { ok: false, error: "This experiment is gone." };
  if (projectId) {
    const project = await getProjectForUser(user.id, projectId);
    if (!project) return { ok: false, error: "This project is gone." };
  }
  await db.update(experiments).set({ projectId }).where(eq(experiments.id, experimentId));
  revalidatePath("/projects");
  revalidatePath("/experiments");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function loadProjects() {
  const user = await requireUser();
  return listProjects(user.id);
}

export async function loadProjectBoard(projectId: string) {
  const user = await requireUser();
  const project = await getProjectForUser(user.id, projectId);
  if (!project) return { ok: false as const, error: "This project is gone." };
  const runs = await listProjectExperiments(user.id, project.id);
  return { ok: true as const, project, runs };
}
