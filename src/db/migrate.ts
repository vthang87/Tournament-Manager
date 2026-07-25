import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./client";

export function runMigrations(databasePath?: string): void {
  const { db, sqlite } = createDb(databasePath);
  try {
    const migrationsFolder = path.join(process.cwd(), "src/db/migrations");
    migrate(db, { migrationsFolder });
  } finally {
    sqlite.close();
  }
}
