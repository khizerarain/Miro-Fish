import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chats, experimentVariants, personas, reactions, researchNotes } from "@/db/schema";
import { parseDefinition } from "@/features/audiences/queries";
import { audiences } from "@/db/schema";
import { reactionPayloadSchema, type PurchaseIntent } from "@/features/simulations/schemas";
import { messagePayloadSchema, type ChatMessageView, type ChatThread, type ResearchNoteView } from "./schemas";

export async function resolveControlVariantId(experimentId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: experimentVariants.id })
    .from(experimentVariants)
    .where(and(eq(experimentVariants.experimentId, experimentId), eq(experimentVariants.isControl, true)))
    .limit(1);
  return row?.id ?? null;
}

export async function ensureChat(experimentId: string, personaId: string, variantId: string) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.experimentId, experimentId), eq(chats.personaId, personaId), eq(chats.variantId, variantId)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(chats).values({ experimentId, personaId, variantId }).returning();
  return created;
}

export async function loadThread(experimentId: string, personaId: string, variantId: string): Promise<ChatThread | null> {
  const db = await getDb();
  const [persona] = await db.select().from(personas).where(eq(personas.id, personaId)).limit(1);
  if (!persona) return null;
  const chat = await ensureChat(experimentId, personaId, variantId);
  const [reaction, msgs, audience] = await Promise.all([
    db
      .select()
      .from(reactions)
      .where(and(eq(reactions.variantId, variantId), eq(reactions.personaId, personaId)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db.select().from(chatMessages).where(eq(chatMessages.chatId, chat.id)).orderBy(asc(chatMessages.createdAt)),
    persona.audienceId
      ? db.select().from(audiences).where(eq(audiences.id, persona.audienceId)).limit(1).then((r) => r[0] ?? null)
      : null,
  ]);
  const labels = audience ? Object.fromEntries(parseDefinition(audience.definition).segments.map((s) => [s.key, s.label])) : {};
  const payload = reaction ? reactionPayloadSchema.safeParse(reaction.payload) : null;
  return {
    chatId: chat.id,
    experimentId,
    personaId,
    variantId,
    personaName: persona.name,
    segmentLabel: labels[persona.segmentKey] ?? persona.segmentKey,
    profession: persona.profession,
    originalImpression: payload?.success ? payload.data.firstImpression : null,
    originalIntent: (reaction?.purchaseIntent as PurchaseIntent | undefined) ?? null,
    originalScore: reaction?.interestScore ?? null,
    messages: msgs.map(toView),
  };
}

export async function listNotes(experimentId: string): Promise<ResearchNoteView[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: researchNotes.id,
      quote: researchNotes.quote,
      context: researchNotes.context,
      source: researchNotes.source,
      createdAt: researchNotes.createdAt,
      personaName: personas.name,
    })
    .from(researchNotes)
    .leftJoin(personas, eq(personas.id, researchNotes.personaId))
    .where(eq(researchNotes.experimentId, experimentId))
    .orderBy(desc(researchNotes.createdAt));
  return rows.map((r) => ({
    id: r.id,
    quote: r.quote,
    context: r.context,
    source: r.source === "reaction" ? "reaction" : "chat",
    personaName: r.personaName,
    createdAt: r.createdAt.toISOString(),
  }));
}

function toView(row: typeof chatMessages.$inferSelect): ChatMessageView {
  const extra = messagePayloadSchema.safeParse(row.payload);
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    mode: extra.success ? extra.data.mode : "chat",
    updatedIntent: extra.success ? extra.data.updatedIntent : null,
    updatedScore: extra.success ? extra.data.updatedScore : null,
    createdAt: row.createdAt.toISOString(),
  };
}
