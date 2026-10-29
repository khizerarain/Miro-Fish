/** Personas per LLM call. Architecture: 20–30. */
export const SIMULATION_BATCH_SIZE = 25;

/** Parallel LLM calls per tick. PGlite writes stay serial after the calls return. */
export const SIMULATION_CONCURRENCY = 2;

/** Above this, simulate a stratified sample and extrapolate the rest (labeled). */
export const ANCHOR_CAP = 1000;

/** Hard cap per experiment unless the row already has a lower cap. $20. */
export const DEFAULT_COST_CAP_CENTS = 2000;

export const CONTROL_VARIANT_LABEL = "Control";
