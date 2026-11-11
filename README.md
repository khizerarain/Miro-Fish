# Miro Fish

Test product ideas on simulated customer personas. Results are **simulated hypotheses**, not market research. See `docs/PRODUCT.md`.

## Quick start

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET (command is in the file)
npm run db:migrate
npm run dev
```

Open http://localhost:3000, sign up, and you land in the dashboard. Press `?` for keyboard shortcuts. Visit `/design` for the component gallery.

With the defaults, no external services are needed:

- **Database:** with `DATABASE_URL` empty, an embedded Postgres (PGlite) is stored in `.data/pglite` and migrated automatically on first request. PGlite is single-process: stop `npm run dev` before running `npm run db:migrate` against it.
- **Auth:** `AUTH_PROVIDER=local` uses built-in email/password with a signed session cookie. Development only.
- **LLM:** `MOCK_LLM=true` runs every screen on deterministic mock data (`MOCK_LLM_DELAY_MS` simulates latency). Set `MOCK_LLM=false` and `ANTHROPIC_API_KEY` to use Claude; `LLM_MODEL` picks the model.

## Workflow

1. Submit an idea (description, URL, pricing, ad).
2. Confirm the analysis, define an audience, generate personas.
3. Simulate reactions and open the research dashboard.
4. Talk to a persona, run A/B variants, or **Improve and rerun** a recommendation.
5. Group runs in **Projects**, compare any two, and watch simulated interest over time.
6. Import a CSV or interview notes for a **reality check** — still not validation.

Audience regeneration keeps personas whose demographics still match the new definition and only fills what changed.


## LLM calls

All model access goes through `lib/llm.ts` → `generateJson()`: Zod-validated JSON, retries on 429/5xx, JSON repair, and a structured `{"evt":"llm",...}` log. Prompts live in `prompts/` as versioned files. UI events log as `{"evt":"ui",...}`.

Per-user rate limits and caps (active experiments, jobs/day) live in `lib/rate-limit.ts` and **Settings → Usage limits**.

## Using Supabase or Neon

1. Set `DATABASE_URL` to your Postgres connection string and run `npm run db:migrate`.
2. For Supabase Auth, set `AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A row in `users` is created on first sign-in.

## Deploy

1. Provision Postgres (Neon or Supabase) and run `npm run db:migrate` against `DATABASE_URL`.
2. Set `AUTH_SECRET` (32+ chars), `APP_URL` to the public origin, and either `MOCK_LLM=true` or `ANTHROPIC_API_KEY`.
3. Deploy the Next.js app (Vercel: import the repo, add the env vars, production command `next build` / `next start`).
4. PGlite is **not** for production. Always set `DATABASE_URL` on the host.
5. Optional: `AUTH_PROVIDER=supabase` with the public URL and anon key.

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
app/          routes: (marketing), (auth), (app) shell, /design, /s share
components/   shared UI; components/ui is shadcn
features/     ideas, audiences, simulations, results, chat, variants, projects, history, improve, reality
lib/          env, auth, LLM, rate limit, usage, analytics
db/           Drizzle schema, client, migrations
jobs/         persona generation, simulation, analysis
prompts/      versioned LLM prompt templates
proxy.ts      route protection (Next.js 16's renamed middleware)
```
