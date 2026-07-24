import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  ConflictError,
  DomainStateError,
  ForbiddenError,
  ValidationError,
} from "@/application/errors";
import {
  CourtService,
  EntryService,
  EventService,
  MatchRuleService,
  StageService,
  TournamentService,
} from "@/application/services";
import type { ActorContext } from "@/core/domain";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { auditLogs } from "@/db/schema";
import { ensureActors } from "@/test/actor-users";

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-t004-"));
  return path.join(dir, "test.db");
}

const admin: ActorContext = { userId: "admin-1", role: "ADMIN" };
const viewer: ActorContext = { userId: "viewer-1", role: "VIEWER" };
const operator: ActorContext = { userId: "op-1", role: "OPERATOR" };

describe("TASK 004 tournament/event/format services", () => {
  let databasePath = "";
  let db: ReturnType<typeof createDb>["db"];
  let sqlite: ReturnType<typeof createDb>["sqlite"];

  beforeEach(async () => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
    ({ db, sqlite } = createDb(databasePath));
    await ensureActors(db, [admin, viewer, operator]);
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  async function seedTournament() {
    const tournament = await new TournamentService(db).create(admin, {
      name: "Open Test",
      slug: "open-test",
      timezone: "UTC",
    });
    return tournament;
  }

  async function seedEvent(tournamentId: string) {
    return new EventService(db).create(admin, {
      tournamentId,
      name: "Men's Doubles",
      type: "DOUBLES",
      genderCategory: "MALE",
    });
  }

  it("creates and updates tournaments with audit", async () => {
    const service = new TournamentService(db);
    const created = await service.create(admin, {
      name: "HCMC Open",
      slug: "hcmc-open",
      timezone: "Asia/Ho_Chi_Minh",
      location: "Saigon",
    });
    expect(created.status).toBe("DRAFT");

    const updated = await service.update(admin, created.id, {
      name: "HCMC Open 2026",
    });
    expect(updated.name).toBe("HCMC Open 2026");

    const logs = await db.select().from(auditLogs);
    expect(logs.some((l) => l.action === "tournament.create")).toBe(true);
    expect(logs.some((l) => l.action === "tournament.update")).toBe(true);
  });

  it("rejects invalid tournament transitions and viewer mutations", async () => {
    const service = new TournamentService(db);
    const tournament = await seedTournament();

    await expect(
      service.transitionStatus(admin, tournament.id, "IN_PROGRESS"),
    ).rejects.toBeInstanceOf(DomainStateError);

    await expect(
      service.create(viewer, {
        name: "Nope",
        slug: "nope",
        timezone: "UTC",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await service.transitionStatus(admin, tournament.id, "REGISTRATION");
    const archived = await service.archive(admin, tournament.id);
    expect(archived.status).toBe("ARCHIVED");
  });

  it("operators cannot perform setup actions", async () => {
    await expect(
      new TournamentService(db).create(operator, {
        name: "Op Tourney",
        slug: "op-tourney",
        timezone: "UTC",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("supports court CRUD with unique codes", async () => {
    const tournament = await seedTournament();
    const courts = new CourtService(db);
    const a = await courts.create(admin, {
      tournamentId: tournament.id,
      name: "Court 1",
      code: "C1",
    });
    expect(a.code).toBe("C1");

    await expect(
      courts.create(admin, {
        tournamentId: tournament.id,
        name: "Court X",
        code: "C1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    await courts.delete(admin, a.id);
    const list = await courts.listByTournament(tournament.id);
    expect(list).toHaveLength(0);
  });

  it("builds a stage pipeline, reorders, and validates rule fallback", async () => {
    const tournament = await seedTournament();
    const event = await seedEvent(tournament.id);
    const rules = new MatchRuleService(db);
    const stages = new StageService(db);

    const groupRule = await rules.create(admin, {
      eventId: event.id,
      name: "Group BO1",
      bestOfSets: 1,
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
    });
    const koRule = await rules.create(admin, {
      eventId: event.id,
      name: "KO BO3",
      bestOfSets: 3,
      pointsToWin: 15,
      winBy: 2,
      maxPoints: 21,
    });

    await new EventService(db).update(admin, event.id, {
      defaultMatchRuleId: groupRule.id,
    });

    const group = await stages.create(admin, {
      eventId: event.id,
      type: "GROUP",
      name: "Group Stage",
      orderIndex: 0,
      format: "GROUP",
      matchRuleId: groupRule.id,
    });
    const r16 = await stages.create(admin, {
      eventId: event.id,
      type: "R16",
      name: "Round of 16",
      orderIndex: 1,
      format: "KNOCKOUT",
      matchRuleId: koRule.id,
    });
    const final = await stages.create(admin, {
      eventId: event.id,
      type: "FINAL",
      name: "Final",
      orderIndex: 2,
      format: "KNOCKOUT",
      // falls back to event default — still resolvable
      matchRuleId: null,
    });

    const validation = await stages.validatePipeline(event.id);
    expect(validation.ok).toBe(true);

    const reordered = await stages.reorder(admin, {
      eventId: event.id,
      orderedStageIds: [r16.stage.id, group.stage.id, final.stage.id],
    });
    expect(reordered.map((s) => s.id)).toEqual([
      r16.stage.id,
      group.stage.id,
      final.stage.id,
    ]);
    expect(reordered.map((s) => s.orderIndex)).toEqual([0, 1, 2]);

    // Remove event default so final (no stage rule) becomes unresolvable
    const { tournamentEvents } = await import("@/db/schema");
    await db
      .update(tournamentEvents)
      .set({ defaultMatchRuleId: null })
      .where(eq(tournamentEvents.id, event.id));
    const after = await stages.validatePipeline(event.id);
    expect(after.ok).toBe(false);
    expect(after.errors.some((e) => e.includes("Final"))).toBe(true);
  });

  it("rejects duplicate stage orderIndex and setup after leaving SETUP", async () => {
    const tournament = await seedTournament();
    const event = await seedEvent(tournament.id);
    const stages = new StageService(db);
    const rules = new MatchRuleService(db);
    const entries = new EntryService(db);

    const rule = await rules.create(admin, {
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

    await expect(
      stages.create(admin, {
        eventId: event.id,
        type: "R16",
        name: "R16",
        orderIndex: 0,
        format: "KNOCKOUT",
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    // Need 2 entries for DRAW_READY
    const { PlayerService } = await import("@/application/services");
    const p1 = await new PlayerService(db).create(admin, {
      name: "A",
      displayName: "A",
    });
    const p2 = await new PlayerService(db).create(admin, {
      name: "B",
      displayName: "B",
    });
    const p3 = await new PlayerService(db).create(admin, {
      name: "C",
      displayName: "C",
    });
    const p4 = await new PlayerService(db).create(admin, {
      name: "D",
      displayName: "D",
    });
    await entries.create(admin, {
      eventId: event.id,
      displayName: "Pair 1",
      members: [
        { playerId: p1.id, position: 1 },
        { playerId: p2.id, position: 2 },
      ],
    });
    await entries.create(admin, {
      eventId: event.id,
      displayName: "Pair 2",
      members: [
        { playerId: p3.id, position: 1 },
        { playerId: p4.id, position: 2 },
      ],
    });

    await new EventService(db).transitionStatus(admin, event.id, "DRAW_READY");

    await expect(
      stages.create(admin, {
        eventId: event.id,
        type: "QF",
        name: "QF",
        orderIndex: 1,
        format: "KNOCKOUT",
      }),
    ).rejects.toBeInstanceOf(DomainStateError);
  });

  it("rejects invalid match rule scoring via engine schema", async () => {
    const tournament = await seedTournament();
    const event = await seedEvent(tournament.id);
    await expect(
      new MatchRuleService(db).create(admin, {
        eventId: event.id,
        name: "Bad",
        bestOfSets: 2, // not odd
        pointsToWin: 21,
        winBy: 2,
        maxPoints: 30,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
