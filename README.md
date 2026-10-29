# Miro Fish

Test product ideas on simulated customer personas. Results are simulated hypotheses, not market research. See `docs/PRODUCT.md`.

## Quick start

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET (command is in the file)
npm run db:migrate
npm run dev
```

Open http://localhost:3000, sign up, and you land in the dashboard. Visit `/design` for the component gallery.

With the defaults, no external services are needed:

- **Database:** with `DATABASE_URL` empty, an embedded Postgres (PGlite) is stored in `.data/pglite` and migrated automatically on first request. PGlite is single-process: stop `npm run dev` before running `npm run db:migrate` against it.
- **Auth:** `AUTH_PROVIDER=local` uses built-in email/password with a signed session cookie. Development only.
- **LLM:** `MOCK_LLM=true` runs every screen on deterministic mock data (`MOCK_LLM_DELAY_MS` simulates latency). Set `MOCK_LLM=false` and `ANTHROPIC_API_KEY` to use Claude; `LLM_MODEL` picks the model.

## LLM calls

All model access goes through `lib/llm.ts` → `generateJson()`: Zod-validated JSON output, retries on 429/5xx, local JSON repair, then up to two model repair passes, and a structured `{"evt":"llm",...}` log line with token counts. Prompt templates live in `prompts/` as versioned files (`analyze-idea.v1.ts`); bump the version when wording changes.

## Using Supabase or Neon

1. Set `DATABASE_URL` to your Postgres connection string and run `npm run db:migrate`.
2. For Supabase Auth, set `AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A row in `users` is created on first sign-in.

## Scripts

| Script                | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Dev server                                        |
| `npm run build`       | Production build                                  |
| `npm run lint`        | ESLint                                            |
| `npm run typecheck`   | TypeScript                                        |
| `npm run format`      | Prettier                                          |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate`  | Apply migrations                                  |
| `npm run db:studio`   | Drizzle Studio                                    |

## Layout

```
app/          routes: (marketing) landing, (auth) login/signup, (app) shell, /design
components/   shared UI; components/ui is shadcn
features/     feature modules (auth, shell, dashboard, ideas wizard, experiments, marketing, design)
lib/          env validation, auth, LLM client, utilities
db/           Drizzle schema, client, migrations
jobs/         background jobs (from Phase 3)
prompts/      versioned LLM prompt templates
proxy.ts      route protection (Next.js 16's renamed middleware)
```
