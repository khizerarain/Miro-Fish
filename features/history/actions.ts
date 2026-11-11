"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getExperimentForUser, loadSegmentLabels } from "@/features/results/queries";
import { getProjectForUser, listProjectExperiments } from "@/features/projects/queries";
import { compareRuns, snapshotRun } from "./queries";

const idSchema = z.uuid();

export async function loadRunHistory(projectId: string) {
  const user = await requireUser();
  const project = await getProjectForUser(user.id, projectId);
  if (!project) return { ok: false as const, error: "This project is gone." };
  const runs = await listProjectExperiments(user.id, project.id);
  const snaps = await Promise.all(runs.filter((r) => r.status === "complete" || r.status === "analyzing").map((r) => snapshotRun(r.id)));
  return {
    ok: true as const,
    project,
    runs,
    series: snaps.filter((s): s is NonNullable<typeof s> => s != null && s.n > 0).reverse(),
  };
}

export async function loadRunCompare(aId: string, bId: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(aId).success || !idSchema.safeParse(bId).success) {
    return { ok: false as const, error: "Pick two runs." };
  }
  const [a, b] = await Promise.all([getExperimentForUser(user.id, aId), getExperimentForUser(user.id, bId)]);
  if (!a || !b) return { ok: false as const, error: "One of those runs is gone." };
  const labels = await loadSegmentLabels(a.audienceId);
  const compared = await compareRuns(a.id, b.id, labels);
  if (!compared) return { ok: false as const, error: "Could not compare those runs." };
  return { ok: true as const, ...compared, segmentLabels: labels };
}
