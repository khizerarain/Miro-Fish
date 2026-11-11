import { z } from "zod";

export const importedRowSchema = z.object({
  interest: z.number().min(0).max(100).nullable(),
  intent: z.string().trim().max(40).nullable(),
  objection: z.string().trim().max(240).nullable(),
  quote: z.string().trim().max(600).nullable(),
  segment: z.string().trim().max(80).nullable(),
});

export type ImportedRow = z.infer<typeof importedRowSchema>;

export type RealityCompare = {
  importedN: number;
  importedMean: number | null;
  simulatedN: number;
  simulatedMean: number | null;
  meanDelta: number | null;
  objectionOverlap: { text: string; imported: number; simulated: number }[];
  caution: string;
};
