import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),

    // Leave empty to use the embedded PGlite database in PGLITE_DIR (local dev only).
    DATABASE_URL: z.url().optional(),
    PGLITE_DIR: z.string().default(".data/pglite"),

    AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

    MOCK_LLM: boolish.default(true),
    MOCK_LLM_DELAY_MS: z.coerce.number().int().min(0).max(30_000).default(1200),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    LLM_MODEL: z.string().default("claude-sonnet-4-5"),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_PROVIDER === "local" && !env.AUTH_SECRET) {
      ctx.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "Required when AUTH_PROVIDER=local" });
    }
    if (env.AUTH_PROVIDER === "supabase") {
      for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when AUTH_PROVIDER=supabase" });
      }
    }
    if (!env.MOCK_LLM && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "Required when MOCK_LLM=false" });
    }
  });

export type Env = z.infer<typeof serverSchema>;

function parseEnv(): Env {
  const parsed = serverSchema.safeParse({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    AUTH_SECRET: process.env.AUTH_SECRET || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example.`);
  }
  return parsed.data;
}

let cached: Env | undefined;

/** Validated server environment. Parsed lazily so importing this module never crashes a build. */
export function env(): Env {
  cached ??= parseEnv();
  return cached;
}
