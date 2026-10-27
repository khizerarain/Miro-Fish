import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

type DbHandle = { db: Database; ready: Promise<void>; close: () => Promise<void> };

/**
 * Postgres when DATABASE_URL is set; otherwise an embedded PGlite database on disk.
 * PGlite is single-process and is migrated automatically on first use.
 */
export function createDb(opts: { databaseUrl?: string; pgliteDir: string }): DbHandle {
  if (opts.databaseUrl) {
    const client = postgres(opts.databaseUrl, { max: 10, prepare: false });
    return {
      db: drizzlePostgres(client, { schema }) as unknown as Database,
      ready: Promise.resolve(),
      close: () => client.end(),
    };
  }

  const dir = path.resolve(opts.pgliteDir);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as Database,
    ready: migratePglite(db, { migrationsFolder: MIGRATIONS_DIR }),
    close: () => client.close(),
  };
}
