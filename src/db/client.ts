import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_URL;
  if (configured && configured.length > 0) {
    return configured.startsWith("file:")
      ? configured.slice("file:".length)
      : configured;
  }
  return path.join(process.cwd(), "data", "tournament-manager.db");
}

export function createSqliteConnection(databasePath = resolveDatabasePath()) {
  const directory = path.dirname(databasePath);
  fs.mkdirSync(directory, { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return sqlite;
}

export function createDb(databasePath?: string) {
  const sqlite = createSqliteConnection(databasePath);
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
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

export function getSqlite(): Database.Database {
  if (!globalForDb.__tmDb) {
    globalForDb.__tmDb = createDb();
  }
  return globalForDb.__tmDb.sqlite;
}
