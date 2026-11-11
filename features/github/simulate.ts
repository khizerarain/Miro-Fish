import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { experimentVariants, experiments, jobs } from "@/db/schema";
import { DEFAULT_COST_CAP_CENTS } from "@/features/simulations/constants";
import { estimateSimulationJob } from "@/features/simulations/cost";
import type { VariantContent } from "@/features/simulations/schemas";

/**
 * Creates the control variant + a queued simulation job for content that did not come from
 * the idea wizard (here: a pull request brief). Idempotent per experiment: an existing
 * control variant is reused and an in-flight simulate job is returned as-is.
 */
export async function enqueueSimulationForContent(opts: {
  ownerId: string;
  experimentId: string;
  audienceId: string;
  ideaId: string | null;
  content: VariantContent;
  /**
   * Personas to simulate in full; the rest are extrapolated by the job (labeled).
   * `"all"` means every persona is simulated directly. An empty array is rejected because it
   * would leave the job with nothing to do and surface as "Nothing to extrapolate from".
   */
  anchorIds: string[] | "all";
  personaTotal: number;
}): Promise<{ jobId: string; variantId: string }> {
  const db = await getDb();
  if (Array.isArray(opts.anchorIds) && opts.anchorIds.length === 0) {
    throw new Error("enqueueSimulationForContent needs at least one anchor persona (or \"all\").");
  }

  const [existingVariant] = await db
    .select()
    .from(experimentVariants)
    .where(eq(experimentVariants.experimentId, opts.experimentId))
    .limit(1);

  const variant =
    existingVariant ??
    (
      await db
        .insert(experimentVariants)
        .values({
          experimentId: opts.experimentId,
          label: "Control",
          isControl: true,
          content: opts.content,
        })
        .returning()
    )[0]!;

  const existingJobs = await db.select().from(jobs).where(eq(jobs.experimentId, opts.experimentId));
  const live = existingJobs.find((j) => j.type === "simulate" && (j.status === "queued" || j.status === "simulating"));
  if (live) return { jobId: live.id, variantId: variant.id };

  const estimate = estimateSimulationJob(opts.personaTotal, false);

  const [job] = await db
    .insert(jobs)
    .values({
      ownerId: opts.ownerId,
      type: "simulate",
      status: "queued",
      experimentId: opts.experimentId,
      audienceId: opts.audienceId,
      ideaId: opts.ideaId,
      totalUnits: opts.personaTotal,
      completedUnits: 0,
      checkpoint: {
        variantId: variant.id,
        anchorIds: opts.anchorIds,
        positivityWarning: null,
      },
      startedAt: new Date(),
    })
    .returning({ id: jobs.id });

  await db
    .update(experiments)
    .set({
      status: "simulating",
      estimatedCostCents: estimate.estimatedCostCents,
      costCapCents: DEFAULT_COST_CAP_CENTS,
      completedAt: null,
    })
    .where(eq(experiments.id, opts.experimentId));

  return { jobId: job!.id, variantId: variant.id };
}
