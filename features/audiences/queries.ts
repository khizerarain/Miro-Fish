import "server-only";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { audiences, experiments, ideas, jobs, personas } from "@/db/schema";
import { analysisSchema } from "@/features/ideas/schemas";
import {
  audienceDefinitionSchema,
  definitionFromAnalysis,
  type AudienceDefinition,
  type AudienceStatus,
} from "./schemas";

export type AudienceRow = typeof audiences.$inferSelect;

export async function getOwnedAudience(userId: string, audienceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(audienceId)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, audienceId), eq(audiences.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getExperimentForUser(userId: string, experimentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(experimentId)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.id, experimentId), eq(experiments.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export function parseDefinition(raw: unknown): AudienceDefinition {
  const parsed = audienceDefinitionSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return definitionFromAnalysis([]);
}

export async function listTemplates(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: audiences.id,
      name: audiences.name,
      size: audiences.size,
      updatedAt: audiences.updatedAt,
      definition: audiences.definition,
    })
    .from(audiences)
    .where(and(eq(audiences.ownerId, userId), eq(audiences.isTemplate, true)))
    .orderBy(desc(audiences.updatedAt));
}

export async function listAudiences(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: audiences.id,
      name: audiences.name,
      size: audiences.size,
      status: audiences.status,
      isTemplate: audiences.isTemplate,
      updatedAt: audiences.updatedAt,
    })
    .from(audiences)
    .where(eq(audiences.ownerId, userId))
    .orderBy(desc(audiences.updatedAt));
}

export async function getActiveJob(audienceId: string) {
  const db = await getDb();
  const inflight = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.audienceId, audienceId),
        eq(jobs.type, "generate_personas"),
        sql`${jobs.status} in ('queued', 'generating')`,
      ),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  if (inflight[0]) return inflight[0];
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.audienceId, audienceId), eq(jobs.type, "generate_personas")))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return job ?? null;
}

export type PersonaListFilter = {
  segment?: string;
  income?: string;
  q?: string;
  ageMin?: number;
  ageMax?: number;
  offset?: number;
  limit?: number;
};

export async function listPersonas(audienceId: string, f: PersonaListFilter = {}) {
  const db = await getDb();
  const limit = Math.min(f.limit ?? 48, 100);
  const offset = f.offset ?? 0;
  const filters = [eq(personas.audienceId, audienceId)];
  if (f.segment) filters.push(eq(personas.segmentKey, f.segment));
  if (f.income) filters.push(eq(personas.incomeBand, f.income));
  if (f.ageMin) filters.push(gte(personas.age, f.ageMin));
  if (f.ageMax) filters.push(lte(personas.age, f.ageMax));
  if (f.q?.trim()) {
    const q = `%${f.q.trim().toLowerCase()}%`;
    filters.push(sql`(lower(${personas.name}) like ${q} or lower(${personas.profession}) like ${q} or lower(${personas.location}) like ${q})`);
  }
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(personas)
      .where(where)
      .orderBy(asc(personas.ordinal))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(personas).where(where),
  ]);
  return { rows, total, limit, offset };
}

export async function personaCounts(audienceId: string) {
  const db = await getDb();
  const [totalRow, bySegment, byIncome, byAge] = await Promise.all([
    db.select({ total: count() }).from(personas).where(eq(personas.audienceId, audienceId)),
    db
      .select({ key: personas.segmentKey, n: count() })
      .from(personas)
      .where(eq(personas.audienceId, audienceId))
      .groupBy(personas.segmentKey),
    db
      .select({ key: personas.incomeBand, n: count() })
      .from(personas)
      .where(eq(personas.audienceId, audienceId))
      .groupBy(personas.incomeBand),
    db.select({ age: personas.age }).from(personas).where(eq(personas.audienceId, audienceId)),
  ]);
  const ageBuckets = new Map<string, number>();
  for (const { age } of byAge) {
    const bucket = String(Math.floor(age / 10) * 10);
    ageBuckets.set(bucket, (ageBuckets.get(bucket) ?? 0) + 1);
  }
  return {
    total: totalRow[0]?.total ?? 0,
    bySegment: Object.fromEntries(bySegment.map((r) => [r.key, r.n])),
    byIncome: Object.fromEntries(byIncome.map((r) => [r.key ?? "unknown", r.n])),
    byAge: [...ageBuckets.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([bucket, n]) => ({ bucket, n })),
  };
}

export type AudiencePageState = {
  experimentId: string;
  experimentName: string;
  ideaId: string | null;
  ideaTitle: string | null;
  analysis: unknown;
  audience: {
    id: string;
    name: string;
    size: number;
    seed: number;
    status: AudienceStatus;
    isTemplate: boolean;
    definition: AudienceDefinition;
  };
};

export async function ensureAudience(userId: string, experimentId: string): Promise<AudiencePageState | null> {
  const exp = await getExperimentForUser(userId, experimentId);
  if (!exp) return null;
  if (exp.audienceId) return loadAudiencePage(userId, experimentId);

  const db = await getDb();
  const idea = exp.ideaId
    ? (await db.select().from(ideas).where(eq(ideas.id, exp.ideaId)).limit(1))[0]
    : undefined;
  const analysis = analysisSchema.safeParse(idea?.analysis);
  const definition = definitionFromAnalysis(analysis.success ? analysis.data.targetMarkets : []);
  const [created] = await db
    .insert(audiences)
    .values({
      ownerId: userId,
      name: `${exp.name} audience`,
      definition,
      size: 100,
      seed: exp.seed,
      status: "draft",
    })
    .returning();
  await db.update(experiments).set({ audienceId: created.id }).where(eq(experiments.id, exp.id));
  return loadAudiencePage(userId, experimentId);
}

export async function loadAudiencePage(userId: string, experimentId: string): Promise<AudiencePageState | null> {
  const exp = await getExperimentForUser(userId, experimentId);
  if (!exp) return null;
  const db = await getDb();
  const idea = exp.ideaId
    ? (await db.select().from(ideas).where(eq(ideas.id, exp.ideaId)).limit(1))[0]
    : undefined;
  const audience = exp.audienceId ? await getOwnedAudience(userId, exp.audienceId) : null;
  if (!audience) return null;
  return {
    experimentId: exp.id,
    experimentName: exp.name,
    ideaId: exp.ideaId,
    ideaTitle: idea?.title ?? null,
    analysis: idea?.analysis ?? null,
    audience: {
      id: audience.id,
      name: audience.name,
      size: audience.size,
      seed: audience.seed,
      status: audience.status,
      isTemplate: audience.isTemplate,
      definition: parseDefinition(audience.definition),
    },
  };
}
