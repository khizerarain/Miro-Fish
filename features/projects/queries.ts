import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { experiments, ideas, projects } from "@/db/schema";

export async function listProjects(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, userId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectForUser(userId: string, projectId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listProjectExperiments(userId: string, projectId: string, includeArchived = false) {
  const db = await getDb();
  const rows = await db
    .select({
      id: experiments.id,
      name: experiments.name,
      status: experiments.status,
      seed: experiments.seed,
      parentExperimentId: experiments.parentExperimentId,
      changeSummary: experiments.changeSummary,
      archivedAt: experiments.archivedAt,
      completedAt: experiments.completedAt,
      createdAt: experiments.createdAt,
      updatedAt: experiments.updatedAt,
      ideaTitle: ideas.title,
    })
    .from(experiments)
    .leftJoin(ideas, eq(ideas.id, experiments.ideaId))
    .where(and(eq(experiments.ownerId, userId), eq(experiments.projectId, projectId)))
    .orderBy(desc(experiments.createdAt));
  return includeArchived ? rows : rows.filter((r) => !r.archivedAt);
}

export async function ensureProject(userId: string, name: string, description?: string | null) {
  const db = await getDb();
  const [created] = await db
    .insert(projects)
    .values({ ownerId: userId, name: name.slice(0, 80), description: description?.slice(0, 400) ?? null })
    .returning();
  return created;
}
