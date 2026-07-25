import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL =
  "postgresql://tournament:tournament@192.168.0.17:5432/tournament_manager";

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (configured && configured.length > 0) {
    return configured;
  }
  return DEFAULT_DATABASE_URL;
}

export function createPool(connectionString = resolveDatabaseUrl()): Pool {
  return new Pool({ connectionString });
}

export function createDb(connectionString?: string) {
  const pool = createPool(connectionString);
  return {
    pool,
    db: drizzle(pool, { schema }),
  };
}

export type AppDatabase = ReturnType<typeof createDb>["db"];

const globalForDb = globalThis as unknown as {
  __tmDb?: ReturnType<typeof createDb>;
};

export function getDb(): AppDatabase {
  if (!globalForDb.__tmDb) {
    globalForDb.__tmDb = createDb();
  }
  return globalForDb.__tmDb.db;
}

export function getPool(): Pool {
  if (!globalForDb.__tmDb) {
    globalForDb.__tmDb = createDb();
  }
  return globalForDb.__tmDb.pool;
}

export async function closeDb(): Promise<void> {
  if (globalForDb.__tmDb) {
    await globalForDb.__tmDb.pool.end();
    globalForDb.__tmDb = undefined;
  }
}
