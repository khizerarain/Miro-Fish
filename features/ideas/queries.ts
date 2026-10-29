import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ideas } from "@/db/schema";
import { inputHash } from "./input-hash";
import {
  analysisSchema,
  emptyIdeaInput,
  type Analysis,
  type IdeaInput,
  type IdeaStatus,
  pricingSchema,
} from "./schemas";

export type IdeaRow = typeof ideas.$inferSelect;

export async function getOwnedIdea(userId: string, ideaId: string): Promise<IdeaRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(ideaId)) return null;
  const db = await getDb();
  const [idea] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, ideaId), eq(ideas.ownerId, userId)))
    .limit(1);
  return idea ?? null;
}

export function rowToInput(row: IdeaRow): IdeaInput {
  const base = emptyIdeaInput();
  const pricing = pricingSchema.safeParse(row.pricing);
  return {
    title: row.title ?? "",
    description: row.description ?? "",
    url: row.url ?? "",
    urlExtract: row.urlExtract ?? "",
    pricing: pricing.success ? pricing.data : base.pricing,
    adHeadline: row.adHeadline ?? "",
    adCopy: row.adCopy ?? "",
    adChannel: (row.adChannel as IdeaInput["adChannel"]) ?? null,
    adImageUrl: row.adImageUrl ?? null,
  };
}

export type WizardState = {
  ideaId: string;
  input: IdeaInput;
  status: IdeaStatus;
  analysis: Analysis | null;
  analysisStale: boolean;
  updatedAt: number;
};

export function rowToWizardState(row: IdeaRow): WizardState {
  const input = rowToInput(row);
  const analysis = analysisSchema.safeParse(row.analysis);
  return {
    ideaId: row.id,
    input,
    status: row.status,
    analysis: analysis.success ? analysis.data : null,
    analysisStale: analysis.success && row.analyzedInputHash !== inputHash(input),
    updatedAt: row.updatedAt.getTime(),
  };
}
