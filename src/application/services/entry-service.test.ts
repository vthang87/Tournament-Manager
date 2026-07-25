import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConflictError,
  DomainStateError,
  ForbiddenError,
  ValidationError,
} from "@/application/errors";
import {
  ClubService,
  EntryService,
  EventService,
  PlayerService,
  TournamentService,
} from "@/application/services";
import type { ActorContext } from "@/core/domain";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import {
  previewDoublesImport,
  previewSinglesImport,
} from "@/features/import-export/parser";
import { ensureActors } from "@/test/actor-users";

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-t005-"));
  return path.join(dir, "test.db");
}

const admin: ActorContext = { userId: "admin-1", role: "ADMIN" };
const viewer: ActorContext = { userId: "viewer-1", role: "VIEWER" };
const scorekeeper: ActorContext = { userId: "sk-1", role: "SCOREKEEPER" };

describe("TASK 005 club/player/entry services", () => {
  let databasePath = "";
  let db: ReturnType<typeof createDb>["db"];
  let sqlite: ReturnType<typeof createDb>["sqlite"];

  beforeEach(async () => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
    ({ db, sqlite } = createDb(databasePath));
    await ensureActors(db, [admin, viewer, scorekeeper]);
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  async function seedDoublesEvent() {
    const tournament = await new TournamentService(db).create(admin, {
      name: "Entry Host",
      slug: "entry-host",
      timezone: "UTC",
    });
    const event = await new EventService(db).create(admin, {
      tournamentId: tournament.id,
      name: "MD",
      type: "DOUBLES",
      genderCategory: "MALE",
    });
    return { tournament, event };
  }

  it("supports club and player CRUD/search", async () => {
    const clubs = new ClubService(db);
    const players = new PlayerService(db);

    const club = await clubs.create(admin, {
      name: "Saigon Smash",
      shortName: "SS",
    });
    const player = await players.create(admin, {
      name: "Nguyen Van A",
      displayName: "A Nguyen",
      clubId: club.id,
      ranking: 10,
    });

    const foundClubs = await clubs.list("Smash");
    expect(foundClubs).toHaveLength(1);
    const foundPlayers = await players.list("Nguyen");
    expect(foundPlayers[0]?.id).toBe(player.id);

    await expect(
      clubs.create(viewer, { name: "Nope" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("enforces doubles cardinality and rejects singles-sized entries", async () => {
    const { event } = await seedDoublesEvent();
    const players = new PlayerService(db);
    const entries = new EntryService(db);
    const p1 = await players.create(admin, { name: "P1", displayName: "P1" });

    await expect(
      entries.create(admin, {
        eventId: event.id,
        displayName: "Solo",
        members: [{ playerId: p1.id, position: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("prevents duplicate membership and duplicate seeds", async () => {
    const { event } = await seedDoublesEvent();
    const players = new PlayerService(db);
    const entries = new EntryService(db);

    const ids = [];
    for (let i = 0; i < 4; i++) {
      ids.push(
        await players.create(admin, {
          name: `P${i}`,
          displayName: `P${i}`,
        }),
      );
    }

    await entries.create(admin, {
      eventId: event.id,
      displayName: "Team A",
      seed: 1,
      members: [
        { playerId: ids[0]!.id, position: 1 },
        { playerId: ids[1]!.id, position: 2 },
      ],
    });

    await expect(
      entries.create(admin, {
        eventId: event.id,
        displayName: "Team B",
        seed: 1,
        members: [
          { playerId: ids[2]!.id, position: 1 },
          { playerId: ids[3]!.id, position: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      entries.create(admin, {
        eventId: event.id,
        displayName: "Team C",
        members: [
          { playerId: ids[0]!.id, position: 1 },
          { playerId: ids[2]!.id, position: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("hard-deletes in SETUP and withdraws afterwards", async () => {
    const { event } = await seedDoublesEvent();
    const players = new PlayerService(db);
    const entries = new EntryService(db);
    const matchRules = await import("@/application/services").then(
      (m) => new m.MatchRuleService(db),
    );
    const stages = await import("@/application/services").then(
      (m) => new m.StageService(db),
    );

    const createdPlayers = [];
    for (let i = 0; i < 4; i++) {
      createdPlayers.push(
        await players.create(admin, {
          name: `W${i}`,
          displayName: `W${i}`,
        }),
      );
    }

    const entry = await entries.create(admin, {
      eventId: event.id,
      displayName: "Draft Pair",
      members: [
        { playerId: createdPlayers[0]!.id, position: 1 },
        { playerId: createdPlayers[1]!.id, position: 2 },
      ],
    });

    const deleted = await entries.deleteOrWithdraw(admin, entry.id);
    expect(deleted.action).toBe("deleted");

    const entry2 = await entries.create(admin, {
      eventId: event.id,
      displayName: "Keep Pair",
      members: [
        { playerId: createdPlayers[0]!.id, position: 1 },
        { playerId: createdPlayers[1]!.id, position: 2 },
      ],
    });
    await entries.create(admin, {
      eventId: event.id,
      displayName: "Other Pair",
      members: [
        { playerId: createdPlayers[2]!.id, position: 1 },
        { playerId: createdPlayers[3]!.id, position: 2 },
      ],
    });

    const rule = await matchRules.create(admin, {
      eventId: event.id,
      name: "Default",
      bestOfSets: 1,
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
    });
    await new EventService(db).update(admin, event.id, {
      defaultMatchRuleId: rule.id,
    });
    await stages.create(admin, {
      eventId: event.id,
      type: "GROUP",
      name: "Groups",
      orderIndex: 0,
      format: "GROUP",
      matchRuleId: rule.id,
    });
    await new EventService(db).transitionStatus(admin, event.id, "DRAW_READY");

    const result = await entries.deleteOrWithdraw(admin, entry2.id);
    expect(result.action).toBe("withdrawn");
    expect(result.entry?.status).toBe("WITHDRAWN");
  });

  it("scorekeeper cannot manage entries", async () => {
    const { event } = await seedDoublesEvent();
    const players = new PlayerService(db);
    const p1 = await players.create(admin, { name: "X", displayName: "X" });
    const p2 = await players.create(admin, { name: "Y", displayName: "Y" });

    await expect(
      new EntryService(db).create(scorekeeper, {
        eventId: event.id,
        displayName: "Nope",
        members: [
          { playerId: p1.id, position: 1 },
          { playerId: p2.id, position: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("disqualify flow works and rejects non-active", async () => {
    const { event } = await seedDoublesEvent();
    const players = new PlayerService(db);
    const entries = new EntryService(db);
    const p1 = await players.create(admin, { name: "D1", displayName: "D1" });
    const p2 = await players.create(admin, { name: "D2", displayName: "D2" });
    const entry = await entries.create(admin, {
      eventId: event.id,
      displayName: "DQ Pair",
      members: [
        { playerId: p1.id, position: 1 },
        { playerId: p2.id, position: 2 },
      ],
    });

    const dq = await entries.setStatus(admin, entry.id, "DISQUALIFIED");
    expect(dq.status).toBe("DISQUALIFIED");

    await expect(
      entries.setStatus(admin, entry.id, "WITHDRAWN"),
    ).rejects.toBeInstanceOf(DomainStateError);
  });

  it("parses import preview rows without Excel", () => {
    const singles = previewSinglesImport([
      {
        displayName: "A Nguyen",
        playerName: "Nguyen A",
        seed: 1,
      },
      { displayName: "", playerName: "Bad" },
      {
        displayName: "B",
        playerName: "B",
        seed: 1,
      },
    ]);
    expect(singles.summary.validCount).toBe(2);
    expect(singles.summary.invalidCount).toBe(1);
    expect(singles.summary.duplicateSeeds).toEqual([1]);

    const doubles = previewDoublesImport([
      {
        displayName: "Pair 1",
        player1Name: "A",
        player2Name: "B",
        seed: 8,
      },
    ]);
    expect(doubles.valid[0]?.ok).toBe(true);
  });
});
