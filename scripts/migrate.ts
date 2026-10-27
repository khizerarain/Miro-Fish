import { config } from "dotenv";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDb, MIGRATIONS_DIR } from "../db/client";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

async function main() {
  const databaseUrl = process.env.DATABASE_URL || undefined;
  const pgliteDir = process.env.PGLITE_DIR || ".data/pglite";
  const target = databaseUrl ? "Postgres (DATABASE_URL)" : `PGlite (${pgliteDir}). Stop the dev server first`;
  console.log(`Running migrations against ${target}...`);

  const h = createDb({ databaseUrl, pgliteDir });
  if (databaseUrl) {
    await migratePostgres(h.db as unknown as PostgresJsDatabase, { migrationsFolder: MIGRATIONS_DIR });
  } else {
    await h.ready;
  }
  await h.close();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
