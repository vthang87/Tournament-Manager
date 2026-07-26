import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import {
  DrizzleTournamentEventRepository,
  DrizzleTournamentRepository,
} from "@/db/repositories";
import { tournamentEvents, tournaments } from "@/db/schema";

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-test-"));
  return path.join(dir, "test.db");
}

describe("TASK 001 foundation repositories", () => {
  let databasePath = "";

  beforeEach(() => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
  });

  afterEach(() => {
    if (databasePath) {
      const dir = path.dirname(databasePath);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates and reads a tournament", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      const repo = new DrizzleTournamentRepository(db);
      const created = await repo.create({
        ownerUserId: "seed-user-admin",
        sportId: "sport-badminton",
        name: "Test Open",
        slug: "test-open",
        timezone: "Asia/Ho_Chi_Minh",
        location: "Saigon",
      });

      const byId = await repo.findById(created.id);
      const bySlug = await repo.findBySlug("test-open");
      const list = await repo.list();

      expect(byId?.name).toBe("Test Open");
      expect(bySlug?.id).toBe(created.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe("DRAFT");
    } finally {
      sqlite.close();
    }
  });

  it("creates and lists events for a tournament", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      const tournamentRepo = new DrizzleTournamentRepository(db);
      const eventRepo = new DrizzleTournamentEventRepository(db);

      const tournament = await tournamentRepo.create({
        ownerUserId: "seed-user-admin",
        sportId: "sport-badminton",
        name: "Event Host",
        slug: "event-host",
        timezone: "Asia/Ho_Chi_Minh",
      });

      const event = await eventRepo.create({
        tournamentId: tournament.id,
        name: "Men's Doubles",
        type: "DOUBLES",
        genderCategory: "MALE",
      });

      const listed = await eventRepo.listByTournamentId(tournament.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(event.id);
      expect(listed[0]?.status).toBe("SETUP");
    } finally {
      sqlite.close();
    }
  });

  it("enforces foreign key restrict when deleting a tournament with events", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      const tournamentRepo = new DrizzleTournamentRepository(db);
      const eventRepo = new DrizzleTournamentEventRepository(db);

      const tournament = await tournamentRepo.create({
        ownerUserId: "seed-user-admin",
        sportId: "sport-badminton",
        name: "FK Host",
        slug: "fk-host",
        timezone: "UTC",
      });

      await eventRepo.create({
        tournamentId: tournament.id,
        name: "Singles",
        type: "SINGLES",
        genderCategory: "OPEN",
      });

      expect(() => {
        sqlite.prepare("delete from tournaments where id = ?").run(tournament.id);
      }).toThrow(/FOREIGN KEY/i);

      const remainingTournaments = await db.select().from(tournaments);
      const remainingEvents = await db.select().from(tournamentEvents);
      expect(remainingTournaments).toHaveLength(1);
      expect(remainingEvents).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it("enables foreign_keys and WAL mode", () => {
    const { sqlite } = createDb(databasePath);
    try {
      const foreignKeys = sqlite.pragma("foreign_keys", { simple: true });
      const journalMode = String(
        sqlite.pragma("journal_mode", { simple: true }),
      ).toLowerCase();

      expect(foreignKeys).toBe(1);
      expect(journalMode).toBe("wal");
    } finally {
      sqlite.close();
    }
  });
});
