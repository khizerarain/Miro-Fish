import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { audiences, experiments, ideas, personas } from "@/db/schema";

export async function cloneIdea(ideaId: string, ownerId: string) {
  const db = await getDb();
  const [src] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  if (!src) return null;
  const [copy] = await db
    .insert(ideas)
    .values({
      ownerId,
      projectId: src.projectId,
      title: src.title,
      description: src.description,
      url: src.url,
      urlExtract: src.urlExtract,
      pricing: src.pricing,
      adHeadline: src.adHeadline,
      adCopy: src.adCopy,
      adChannel: src.adChannel,
      adImageUrl: src.adImageUrl,
      analysis: src.analysis,
      analyzedInputHash: src.analyzedInputHash,
      status: src.status,
    })
    .returning();
  return copy;
}

export async function cloneAudience(audienceId: string, ownerId: string) {
  const db = await getDb();
  const [src] = await db.select().from(audiences).where(eq(audiences.id, audienceId)).limit(1);
  if (!src) return null;
  const [copy] = await db
    .insert(audiences)
    .values({
      ownerId,
      projectId: src.projectId,
      name: src.name,
      definition: src.definition,
      size: src.size,
      seed: src.seed,
      isTemplate: false,
      status: src.status,
    })
    .returning();
  const people = await db.select().from(personas).where(eq(personas.audienceId, src.id));
  if (people.length) {
    await db.insert(personas).values(
      people.map((p) => ({
        audienceId: copy.id,
        ordinal: p.ordinal,
        segmentKey: p.segmentKey,
        name: p.name,
        age: p.age,
        gender: p.gender,
        location: p.location,
        profession: p.profession,
        incomeBand: p.incomeBand,
        techComfort: p.techComfort,
        profile: p.profile,
      })),
    );
  }
  return copy;
}

export async function cloneExperiment(opts: {
  sourceId: string;
  ownerId: string;
  name: string;
  ideaId: string | null;
  audienceId: string | null;
  changeSummary: string;
  status?: (typeof experiments.$inferInsert)["status"];
}) {
  const db = await getDb();
  const [src] = await db.select().from(experiments).where(eq(experiments.id, opts.sourceId)).limit(1);
  if (!src) return null;
  const [copy] = await db
    .insert(experiments)
    .values({
      ownerId: opts.ownerId,
      projectId: src.projectId,
      ideaId: opts.ideaId,
      audienceId: opts.audienceId,
      name: opts.name,
      status: opts.status ?? "draft",
      seed: src.seed,
      costCapCents: src.costCapCents,
      parentExperimentId: src.id,
      changeSummary: opts.changeSummary,
    })
    .returning();
  return copy;
}
