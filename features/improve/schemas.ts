import { z } from "zod";

export const improveDraftSchema = z.object({
  description: z.string().trim().min(40).max(5000),
  valueProposition: z.string().trim().min(8).max(500),
  adHeadline: z.string().trim().max(200),
  adCopy: z.string().trim().max(3000),
  rationale: z.string().trim().min(20).max(800),
});

export type ImproveDraft = z.infer<typeof improveDraftSchema>;
