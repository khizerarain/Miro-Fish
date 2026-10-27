import "server-only";
import { env } from "@/lib/env";
import { createDb, type Database } from "./client";

const globalForDb = globalThis as unknown as { __miroDb?: ReturnType<typeof createDb> };

function handle() {
  if (!globalForDb.__miroDb) {
    const e = env();
    globalForDb.__miroDb = createDb({ databaseUrl: e.DATABASE_URL, pgliteDir: e.PGLITE_DIR });
  }
  return globalForDb.__miroDb;
}

/** Shared database instance. Awaits pending local migrations before first use. */
export async function getDb(): Promise<Database> {
  const h = handle();
  await h.ready;
  return h.db;
}

export * as schema from "./schema";
