import "server-only";
import { z } from "zod";
import { repairJsonV1 } from "@/prompts/repair-json.v1";
import type { PromptTemplate } from "@/prompts/types";
import { env } from "./env";
import { estimateTokens, extractJson } from "./llm-json";

export type LlmImage = { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string };

export type LlmUsage = {
  model: string;
  mock: boolean;
  inputTokens: number;
  outputTokens: number;
  /** Provider calls made, including retries and repairs. */
  calls: number;
  repaired: boolean;
  durationMs: number;
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: "provider" | "invalid_output" | "config",
  ) {
    super(message);
    this.name = "LlmError";
  }
}

type CompletionRequest = {
  system: string;
  user: string;
  images?: LlmImage[];
  maxTokens: number;
  temperature: number;
};
type Completion = { text: string; inputTokens: number; outputTokens: number };

const MAX_TRANSIENT_RETRIES = 3;
const MAX_REPAIRS = 2;
const REQUEST_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function anthropicComplete(req: CompletionRequest): Promise<Completion> {
  const e = env();
  if (!e.ANTHROPIC_API_KEY) throw new LlmError("ANTHROPIC_API_KEY is not set", "config");

  const content = [
    ...(req.images ?? []).map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
    })),
    { type: "text" as const, text: req.user },
  ];

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": e.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: e.LLM_MODEL,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          system: req.system,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await sleep(backoff(attempt));
        continue;
      }
      throw new LlmError(`Network error calling the AI provider: ${(err as Error).message}`, "provider");
    }

    if (res.ok) {
      const body = (await res.json()) as {
        content: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        text: body.content.map((c) => (c.type === "text" ? (c.text ?? "") : "")).join(""),
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      };
    }

    const transient = res.status === 429 || res.status === 529 || res.status >= 500;
    if (transient && attempt < MAX_TRANSIENT_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      continue;
    }
    const detail = (await res.text()).slice(0, 300);
    throw new LlmError(`AI provider returned ${res.status}: ${detail}`, "provider");
  }
}

function backoff(attempt: number) {
  return Math.min(8000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 400);
}

function logUsage(promptRef: string, usage: LlmUsage, outcome: "ok" | "error") {
  console.info(
    JSON.stringify({
      evt: "llm",
      prompt: promptRef,
      outcome,
      model: usage.model,
      mock: usage.mock,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      calls: usage.calls,
      repaired: usage.repaired,
      ms: usage.durationMs,
    }),
  );
}

/**
 * The only way the app talks to an LLM. Returns Zod-validated JSON.
 * Retries transient provider errors, repairs malformed JSON (locally, then by asking the model),
 * and logs token usage. With MOCK_LLM=true, returns `mock(vars)` without calling any provider.
 */
export async function generateJson<T, V>(opts: {
  prompt: PromptTemplate<V>;
  vars: V;
  schema: z.ZodType<T>;
  mock: (vars: V) => T;
  images?: LlmImage[];
  /** Override mock latency (persona batches should be shorter than a full analysis). */
  mockDelayMs?: number;
}): Promise<{ data: T; usage: LlmUsage; promptRef: string }> {
  const e = env();
  const promptRef = `${opts.prompt.id}@${opts.prompt.version}`;
  const started = Date.now();
  const user = opts.prompt.render(opts.vars);
  const usage: LlmUsage = {
    model: e.MOCK_LLM ? "mock" : e.LLM_MODEL,
    mock: e.MOCK_LLM,
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
    repaired: false,
    durationMs: 0,
  };

  if (e.MOCK_LLM) {
    await sleep(opts.mockDelayMs ?? e.MOCK_LLM_DELAY_MS);
    const data = opts.schema.parse(opts.mock(opts.vars));
    usage.inputTokens = estimateTokens(opts.prompt.system + user);
    usage.outputTokens = estimateTokens(JSON.stringify(data));
    usage.durationMs = Date.now() - started;
    logUsage(promptRef, usage, "ok");
    return { data, usage, promptRef };
  }

  const jsonSchema = JSON.stringify(z.toJSONSchema(opts.schema));
  let request: CompletionRequest = {
    system: opts.prompt.system,
    user,
    images: opts.images,
    maxTokens: opts.prompt.maxTokens,
    temperature: opts.prompt.temperature,
  };

  try {
    for (let repairs = 0; ; repairs++) {
      const completion = await anthropicComplete(request);
      usage.calls++;
      usage.inputTokens += completion.inputTokens;
      usage.outputTokens += completion.outputTokens;

      const parsed = opts.schema.safeParse(extractJson(completion.text));
      if (parsed.success) {
        usage.durationMs = Date.now() - started;
        logUsage(promptRef, usage, "ok");
        return { data: parsed.data, usage, promptRef };
      }
      if (repairs >= MAX_REPAIRS) {
        throw new LlmError(
          `AI output failed validation: ${z.prettifyError(parsed.error).slice(0, 500)}`,
          "invalid_output",
        );
      }
      usage.repaired = true;
      request = {
        system: repairJsonV1.system,
        user: repairJsonV1.render({
          badOutput: completion.text.slice(0, 20_000),
          error: z.prettifyError(parsed.error),
          jsonSchema,
        }),
        maxTokens: Math.max(repairJsonV1.maxTokens, opts.prompt.maxTokens),
        temperature: repairJsonV1.temperature,
      };
    }
  } catch (err) {
    usage.durationMs = Date.now() - started;
    logUsage(promptRef, usage, "error");
    throw err;
  }
}

export function dataUrlToImage(dataUrl: string): LlmImage | undefined {
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  return m ? { mediaType: m[1] as LlmImage["mediaType"], base64: m[2] } : undefined;
}
