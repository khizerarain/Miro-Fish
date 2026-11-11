"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { chatMessages, chats, experimentVariants, personas, reactions, researchNotes } from "@/db/schema";
import { profileOf } from "@/features/audiences/profile";
import { getExperimentForUser } from "@/features/results/queries";
import { ensureControlVariant, loadIdeaForExperiment, parseVariantContent } from "@/features/simulations/queries";
import { requireUser } from "@/lib/auth";
import { generateJson } from "@/lib/llm";
import { chatPersonaV1 } from "@/prompts/chat-persona.v1";
import { mockChatReply } from "./mock";
import { resolveControlVariantId, ensureChat, listNotes, loadThread } from "./queries";
import { chatReplySchema, saveNoteSchema, sendChatSchema, type ChatThread, type ResearchNoteView } from "./schemas";

type Fail = { ok: false; error: string };
const idSchema = z.uuid();

export async function openChat(
  experimentId: string,
  personaId: string,
  variantId?: string | null,
): Promise<{ ok: true; thread: ChatThread } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success || !idSchema.safeParse(personaId).success) {
    return { ok: false, error: "Unknown conversation." };
  }
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  let vid = variantId && idSchema.safeParse(variantId).success ? variantId : await resolveControlVariantId(exp.id);
  if (!vid) {
    const idea = await loadIdeaForExperiment(exp.ideaId);
    const created = await ensureControlVariant(exp.id, idea);
    vid = created.id;
  }
  const thread = await loadThread(exp.id, personaId, vid);
  if (!thread) return { ok: false, error: "This persona is missing." };
  return { ok: true, thread };
}

export async function sendChatMessage(input: unknown): Promise<{ ok: true; thread: ChatThread } | Fail> {
  const user = await requireUser();
  const parsed = sendChatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message did not look right." };
  const { experimentId, personaId, variantId, message, mode } = parsed.data;
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };

  const db = await getDb();
  const [persona] = await db.select().from(personas).where(eq(personas.id, personaId)).limit(1);
  const [variant] = await db.select().from(experimentVariants).where(eq(experimentVariants.id, variantId)).limit(1);
  const [reaction] = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.variantId, variantId), eq(reactions.personaId, personaId)))
    .limit(1);
  if (!persona || !variant || variant.experimentId !== exp.id) return { ok: false, error: "This conversation is unavailable." };

  const chat = await ensureChat(exp.id, personaId, variantId);
  await db.insert(chatMessages).values({
    chatId: chat.id,
    role: "user",
    content: message,
    payload: { mode, updatedIntent: null, updatedScore: null },
  });

  const history = await db.select().from(chatMessages).where(eq(chatMessages.chatId, chat.id));
  const profile = profileOf(persona);
  const product = parseVariantContent(variant.content);
  const vars = {
    personaXml: personaXml(persona, profile),
    productJson: JSON.stringify(product),
    originalReactionJson: JSON.stringify(reaction?.payload ?? { note: "No stored reaction yet." }),
    historyXml: history
      .slice(0, -1)
      .map((m) => `<turn role="${m.role}">${escapeXml(m.content)}</turn>`)
      .join("\n"),
    userMessage: message,
    mode,
    jsonSchema: JSON.stringify(z.toJSONSchema(chatReplySchema)),
  };

  const out = await generateJson({
    prompt: chatPersonaV1,
    vars,
    schema: chatReplySchema,
    mock: mockChatReply,
    mockDelayMs: 380,
  });

  const reply = mode === "convince" ? out.data : { ...out.data, updatedIntent: null, updatedScore: null };
  await db.insert(chatMessages).values({
    chatId: chat.id,
    role: "assistant",
    content: reply.reply,
    payload: { mode, updatedIntent: reply.updatedIntent, updatedScore: reply.updatedScore },
  });
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chat.id));

  const thread = await loadThread(exp.id, personaId, variantId);
  if (!thread) return { ok: false, error: "Could not reload the thread." };
  return { ok: true, thread };
}

export async function saveResearchNote(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = saveNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That quote is too short to pin." };
  const exp = await getExperimentForUser(user.id, parsed.data.experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  const db = await getDb();
  await db.insert(researchNotes).values({
    ownerId: user.id,
    experimentId: exp.id,
    personaId: parsed.data.personaId,
    variantId: parsed.data.variantId,
    quote: parsed.data.quote,
    context: parsed.data.context ?? null,
    source: parsed.data.source,
  });
  return { ok: true };
}

export async function deleteResearchNote(noteId: string): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(noteId).success) return { ok: false, error: "Unknown note." };
  const db = await getDb();
  const [row] = await db.select().from(researchNotes).where(eq(researchNotes.id, noteId)).limit(1);
  if (!row || row.ownerId !== user.id) return { ok: false, error: "This note is gone." };
  await db.delete(researchNotes).where(eq(researchNotes.id, noteId));
  return { ok: true };
}

export async function loadNotesBoard(experimentId: string): Promise<{ ok: true; notes: ResearchNoteView[] } | Fail> {
  const user = await requireUser();
  if (!idSchema.safeParse(experimentId).success) return { ok: false, error: "Unknown experiment." };
  const exp = await getExperimentForUser(user.id, experimentId);
  if (!exp) return { ok: false, error: "This experiment no longer exists." };
  return { ok: true, notes: await listNotes(exp.id) };
}

function personaXml(persona: typeof personas.$inferSelect, profile: ReturnType<typeof profileOf>) {
  return `name: ${persona.name}
age: ${persona.age}; profession: ${persona.profession ?? ""}
segment: ${persona.segmentKey}; location: ${persona.location ?? ""}
income: ${persona.incomeBand ?? ""}
${
  profile
    ? `traits: ${profile.personalityTraits.join(", ")}
needs: ${profile.needs.join("; ")}
painPoints: ${profile.painPoints.join("; ")}
usesToday: ${profile.currentAlternatives.join("; ")}
buying: ${profile.buyingBehavior.style}, ${profile.buyingBehavior.priceSensitivity} price sensitivity
money: ${profile.financialSituation}
backstory: ${profile.backstory}`
    : ""
}`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
