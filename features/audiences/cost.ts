import { PERSONA_BATCH_SIZE } from "./constants";

/** Rough Sonnet list prices used only for the pre-run estimate. */
const INPUT_CENTS_PER_MTOK = 300;
const OUTPUT_CENTS_PER_MTOK = 1500;
const INPUT_TOKENS_PER_BATCH = 2_200;
const OUTPUT_TOKENS_PER_BATCH = 3_800;
const SECONDS_PER_LIVE_BATCH = 18;
const SECONDS_PER_MOCK_BATCH = 0.35;

export function estimatePersonaJob(size: number, mock: boolean) {
  const batches = Math.max(1, Math.ceil(size / PERSONA_BATCH_SIZE));
  const inputTok = batches * INPUT_TOKENS_PER_BATCH;
  const outputTok = batches * OUTPUT_TOKENS_PER_BATCH;
  const estimatedCostCents = mock
    ? 0
    : Math.round((inputTok / 1_000_000) * INPUT_CENTS_PER_MTOK + (outputTok / 1_000_000) * OUTPUT_CENTS_PER_MTOK);
  const seconds = batches * (mock ? SECONDS_PER_MOCK_BATCH : SECONDS_PER_LIVE_BATCH);
  const estimatedMinutes = Math.max(1, Math.round(seconds / 60));
  const estimatedSeconds = Math.max(8, Math.round(seconds));
  return { batches, batchSize: PERSONA_BATCH_SIZE, mock, estimatedCostCents, estimatedMinutes, estimatedSeconds };
}

export function formatCost(cents: number, mock: boolean) {
  if (mock) return "No API cost (mock mode)";
  if (cents < 100) return `about $${(cents / 100).toFixed(2)}`;
  return `about $${Math.round(cents / 100)}`;
}

export function formatDuration(seconds: number, minutes: number) {
  if (seconds < 50) return `about ${seconds} seconds`;
  if (minutes === 1) return "about a minute";
  return `about ${minutes} minutes`;
}
