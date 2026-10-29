import { formatCost, formatDuration } from "@/features/audiences/cost";
import { ANCHOR_CAP, SIMULATION_BATCH_SIZE, SIMULATION_CONCURRENCY } from "./constants";

const INPUT_CENTS_PER_MTOK = 300;
const OUTPUT_CENTS_PER_MTOK = 1500;
const INPUT_TOKENS_PER_BATCH = 2_800;
const OUTPUT_TOKENS_PER_BATCH = 4_400;
const SECONDS_PER_LIVE_BATCH = 22;
const SECONDS_PER_MOCK_BATCH = 0.7;

export { formatCost, formatDuration };

export function anchorCountFor(size: number) {
  return Math.min(size, ANCHOR_CAP);
}

export function estimateSimulationJob(size: number, mock: boolean) {
  const anchors = anchorCountFor(size);
  const extrapolated = size - anchors;
  const batches = Math.max(1, Math.ceil(anchors / SIMULATION_BATCH_SIZE));
  const waves = Math.ceil(batches / SIMULATION_CONCURRENCY);
  const inputTok = batches * INPUT_TOKENS_PER_BATCH;
  const outputTok = batches * OUTPUT_TOKENS_PER_BATCH;
  const estimatedCostCents = mock
    ? 0
    : Math.round((inputTok / 1_000_000) * INPUT_CENTS_PER_MTOK + (outputTok / 1_000_000) * OUTPUT_CENTS_PER_MTOK);
  const seconds =
    waves * (mock ? SECONDS_PER_MOCK_BATCH : SECONDS_PER_LIVE_BATCH) + (extrapolated ? 2 : 0);
  const estimatedMinutes = Math.max(1, Math.round(seconds / 60));
  const estimatedSeconds = Math.max(8, Math.round(seconds));
  return {
    anchors,
    extrapolated,
    batches,
    batchSize: SIMULATION_BATCH_SIZE,
    mock,
    estimatedCostCents,
    estimatedMinutes,
    estimatedSeconds,
  };
}

export function centsFromTokens(inputTokens: number, outputTokens: number) {
  return Math.round((inputTokens / 1_000_000) * INPUT_CENTS_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_CENTS_PER_MTOK);
}
