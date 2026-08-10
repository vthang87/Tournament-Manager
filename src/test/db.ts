import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "@/db/client";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://tournament:tournament@192.168.0.17:5432/tournament_manager_test";

let migrationsApplied = false;

function resolveTestDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

export async function createTestDb() {
  const connectionString = resolveTestDatabaseUrl();
  const { db, pool } = createDb(connectionString);

  if (!migrationsApplied) {
    const migrationsFolder = path.join(process.cwd(), "src/db/migrations");
    await migrate(db, { migrationsFolder });
    migrationsApplied = true;
  }

  await db.execute(sql`
    TRUNCATE TABLE
      audit_logs,
      match_sets,
      matches,
      draw_results,
      group_entries,
      groups,
      draw_sessions,
      tournament_members,
      entry_members,
      entries,
      player_sports,
      players,
      clubs,
      stage_rules,
      qualification_rules,
      schedule_rules,
      standing_rules,
      stages,
      match_rules,
      courts,
      tournament_events,
      tournaments,
      users
    RESTART IDENTITY CASCADE
  `);

  return {
    db,
    async close() {
      await pool.end();
    },
  };
}
