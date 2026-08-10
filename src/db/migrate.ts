import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";

export async function runMigrations(connectionString?: string): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    const migrationsFolder = path.join(process.cwd(), "src/db/migrations");
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
