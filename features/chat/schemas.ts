import { z } from "zod";
import { purchaseIntentSchema, type PurchaseIntent } from "@/features/simulations/schemas";

export const chatModeSchema = z.enum(["chat", "convince"]);
export type ChatMode = z.infer<typeof chatModeSchema>;

export const chatReplySchema = z.object({
  reply: z.string().trim().min(8).max(800),
  updatedIntent: purchaseIntentSchema.nullable(),
  updatedScore: z.number().int().min(0).max(100).nullable(),
  notableQuote: z.string().trim().min(8).max(280).nullable(),
});

export type ChatReply = z.infer<typeof chatReplySchema>;

export const sendChatSchema = z.object({
  experimentId: z.uuid(),
  personaId: z.uuid(),
  variantId: z.uuid(),
  message: z.string().trim().min(2).max(1200),
  mode: chatModeSchema,
});

export const saveNoteSchema = z.object({
  experimentId: z.uuid(),
  personaId: z.uuid().nullable(),
  variantId: z.uuid().nullable(),
  quote: z.string().trim().min(8).max(600),
  context: z.string().trim().max(240).optional(),
  source: z.enum(["chat", "reaction"]),
});

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  updatedIntent: PurchaseIntent | null;
  updatedScore: number | null;
  createdAt: string;
};

export type ChatThread = {
  chatId: string;
  experimentId: string;
  personaId: string;
  variantId: string;
  personaName: string;
  segmentLabel: string;
  profession: string | null;
  originalImpression: string | null;
  originalIntent: PurchaseIntent | null;
  originalScore: number | null;
  messages: ChatMessageView[];
};

export type ResearchNoteView = {
  id: string;
  quote: string;
  context: string | null;
  source: "chat" | "reaction";
  personaName: string | null;
  createdAt: string;
};

export const messagePayloadSchema = z.object({
  mode: chatModeSchema.default("chat"),
  updatedIntent: purchaseIntentSchema.nullable().default(null),
  updatedScore: z.number().int().min(0).max(100).nullable().default(null),
});
