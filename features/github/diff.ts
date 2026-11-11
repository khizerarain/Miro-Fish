import "server-only";
import { z } from "zod";
import { githubApi } from "@/lib/github/app";
import { generateJson } from "@/lib/llm";
import { changeBriefV1 } from "@/prompts/change-brief.v1";
import { changeBriefSchema, isInternalPath, mockChangeBrief, type ChangeBrief } from "./brief";

const DIFF_BUDGET_CHARS = 24_000;
const MAX_FILES_LISTED = 120;

type PrFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

/** GitHub caps this endpoint at 3000 files; enough for a review and cheap to page. */
export async function listPrFiles(installationId: number, fullName: string, prNumber: number): Promise<PrFile[]> {
  const files: PrFile[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await githubApi<PrFile[]>(
      installationId,
      `/repos/${fullName}/pulls/${prNumber}/files?per_page=100&page=${page}`,
    );
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

function truncatePatch(patch: string, budget: number): { text: string; truncated: boolean } {
  if (patch.length <= budget) return { text: patch, truncated: false };
  return { text: `${patch.slice(0, budget)}\n… [patch truncated]`, truncated: true };
}

/**
 * Builds a bounded, plain-text view of the diff and asks the model what a customer would notice.
 * All non-customer files are listed but their patches are dropped, which keeps the prompt small
 * and stops test churn from dominating the brief.
 */
export async function buildChangeBrief(input: {
  installationId: number;
  fullName: string;
  prNumber: number;
  title: string;
  body: string;
  files: PrFile[];
}): Promise<{ brief: ChangeBrief; truncated: boolean; filesSeen: number }> {
  const { files } = input;
  const filesSeen = files.length;
  let remaining = DIFF_BUDGET_CHARS;
  let truncated = false;

  const blocks: string[] = [];
  for (const f of files) {
    const internal = isInternalPath(f.filename);
    const header = `### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`;
    if (internal || !f.patch) {
      blocks.push(header);
      continue;
    }
    const budget = Math.min(remaining, 6000);
    if (budget <= 200) {
      truncated = true;
      blocks.push(`${header}\n[patch omitted: prompt budget reached]`);
      continue;
    }
    const cut = truncatePatch(f.patch, budget);
    remaining -= cut.text.length;
    if (cut.truncated) truncated = true;
    blocks.push(`${header}\n${cut.text}`);
  }

  const diffStat = files
    .map((f) => `${f.filename} | +${f.additions} -${f.deletions}`)
    .slice(0, MAX_FILES_LISTED)
    .join("\n");

  const { data } = await generateJson({
    prompt: changeBriefV1,
    vars: {
      repoFullName: input.fullName,
      prNumber: input.prNumber,
      title: input.title,
      body: (input.body ?? "").slice(0, 4000),
      files: blocks.join("\n\n"),
      diffStat: diffStat || "(no files)",
      jsonSchema: JSON.stringify(z.toJSONSchema(changeBriefSchema)),
    },
    schema: changeBriefSchema,
    mock: () =>
      mockChangeBrief({
        title: input.title,
        body: input.body ?? "",
        files: files.map((f) => f.filename),
      }),
    mockDelayMs: 520,
  });

  return { brief: data, truncated, filesSeen };
}
