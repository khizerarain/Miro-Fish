import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { experiments, ideas } from "@/db/schema";

export type ExperimentListItem = {
  id: string;
  name: string;
  ideaId: string | null;
  projectId: string | null;
  ideaStatus: (typeof ideas.$inferSelect)["status"] | null;
  runStatus: (typeof experiments.$inferSelect)["status"];
  updatedAt: Date;
};

/** `now` is captured with the query so relative times render consistently. */
export async function listExperiments(
  userId: string,
  limit = 50,
  opts: { archived?: boolean } = {},
): Promise<{ items: ExperimentListItem[]; now: number }> {
  const db = await getDb();
  const archivedFilter = opts.archived ? isNotNull(experiments.archivedAt) : isNull(experiments.archivedAt);
  const items = await db
    .select({
      id: experiments.id,
      name: experiments.name,
      ideaId: experiments.ideaId,
      projectId: experiments.projectId,
      ideaStatus: ideas.status,
      runStatus: experiments.status,
      updatedAt: ideas.updatedAt,
    })
    .from(experiments)
    .leftJoin(ideas, eq(ideas.id, experiments.ideaId))
    .where(and(eq(experiments.ownerId, userId), archivedFilter))
    .orderBy(desc(opts.archived ? experiments.archivedAt : ideas.updatedAt))
    .limit(limit)
    .then((rows) => rows.map((r) => ({ ...r, updatedAt: r.updatedAt ?? new Date(0) })));
  return { items, now: Date.now() };
}
