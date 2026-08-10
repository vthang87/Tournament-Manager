import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  DomainStateError,
  ForbiddenError,
} from "@/application/errors";
import {
  DrawService,
  EntryService,
  EventService,
  MatchGenerationService,
  MatchRuleService,
  PlayerService,
  StageService,
  TournamentService,
} from "@/application/services";
import type { ActorContext } from "@/core/domain";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { auditLogs, matches } from "@/db/schema";
import { DrizzleDrawRepository } from "@/db/repositories/draw-repository";
import { ensureActors } from "@/test/actor-users";

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-t006-008-"));
  return path.join(dir, "test.db");
}

const admin: ActorContext = { userId: "admin-1", role: "ADMIN" };
const operator: ActorContext = { userId: "op-1", role: "OPERATOR" };
const viewer: ActorContext = { userId: "viewer-1", role: "VIEWER" };

describe("TASK 006/008 draw persistence + round-robin match generation", () => {
  let databasePath = "";
  let db: ReturnType<typeof createDb>["db"];
  let sqlite: ReturnType<typeof createDb>["sqlite"];

  beforeEach(async () => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
    ({ db, sqlite } = createDb(databasePath));
    await ensureActors(db, [admin, operator, viewer]);
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  async function seedGroupEvent(opts?: {
    entryCount?: number;
    groupCount?: number;
    capacity?: number;
  }) {
    const entryCount = opts?.entryCount ?? 8;
    const groupCount = opts?.groupCount ?? 2;
    const capacity = opts?.capacity ?? 4;

    const tournament = await new TournamentService(db).create(admin, {
      name: "Draw Host",
      slug: `draw-host-${Math.random().toString(36).slice(2, 8)}`,
      timezone: "UTC",
    });
    const event = await new EventService(db).create(admin, {
      tournamentId: tournament.id,
      name: "MD",
      type: "DOUBLES",
      genderCategory: "MALE",
    });
    const rule = await new MatchRuleService(db).create(admin, {
      eventId: event.id,
      name: "Group BO1",
      bestOfSets: 1,
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
    });
    await new EventService(db).update(admin, event.id, {
      defaultMatchRuleId: rule.id,
    });
    const { stage } = await new StageService(db).create(admin, {
      eventId: event.id,
      type: "GROUP",
      name: "Group Stage",
      orderIndex: 0,
      format: "GROUP",
      matchRuleId: rule.id,
    });
    await new StageService(db).create(admin, {
      eventId: event.id,
      type: "KNOCKOUT",
      name: "Knockout",
      orderIndex: 1,
      format: "KNOCKOUT",
      matchRuleId: rule.id,
    });

    const players = new PlayerService(db);
    const entries = new EntryService(db);
    const playerIds: string[] = [];
    for (let i = 0; i < entryCount * 2; i++) {
      const p = await players.create(admin, {
        name: `Player ${i}`,
        displayName: `P${i}`,
      });
      playerIds.push(p.id);
    }
    for (let i = 0; i < entryCount; i++) {
      await entries.create(admin, {
        eventId: event.id,
        displayName: `Team ${i + 1}`,
        seed: i < Math.min(entryCount, 8) ? i + 1 : null,
        members: [
          { playerId: playerIds[i * 2]!, position: 1 },
          { playerId: playerIds[i * 2 + 1]!, position: 2 },
        ],
      });
    }

    await new EventService(db).transitionStatus(admin, event.id, "DRAW_READY");

    return {
      tournament,
      event: await new EventService(db).getById(event.id),
      stage,
      rule,
      groupCount,
      capacity,
    };
  }

  it("generates DRAFT draw, redraws idempotently, confirms with audit", async () => {
    const { event, stage, groupCount, capacity } = await seedGroupEvent({
      entryCount: 8,
      groupCount: 2,
      capacity: 4,
    });
    const draws = new DrawService(db);

    const first = await draws.generateDraw(operator, {
      eventId: event.id,
      stageId: stage.id,
      configuration: {
        seedDistribution: "NORMAL",
        avoidSameClub: true,
        groupCount,
        capacityPerGroup: capacity,
      },
      randomSeed: 42,
    });
    expect(first.session.status).toBe("DRAFT");
    expect(first.results).toHaveLength(8);
    expect(first.redrawn).toBe(false);
    expect(first.groups).toHaveLength(2);

    const entryIds = first.results.map((r) => r.entryId);
    expect(new Set(entryIds).size).toBe(8);

    const second = await draws.generateDraw(operator, {
      eventId: event.id,
      stageId: stage.id,
      configuration: {
        seedDistribution: "NORMAL",
        avoidSameClub: true,
        groupCount,
        capacityPerGroup: capacity,
      },
      randomSeed: 99,
    });
    expect(second.redrawn).toBe(true);
    expect(second.session.id).toBe(first.session.id);

    const confirmed = await draws.confirmDraw(operator, {
      drawSessionId: first.session.id,
    });
    expect(confirmed.session.status).toBe("LOCKED");
    expect(confirmed.groupEntries).toBe(8);

    const updatedEvent = await new EventService(db).getById(event.id);
    expect(updatedEvent.status).toBe("DRAW_CONFIRMED");

    const stageGroups = await draws.listGroups(stage.id);
    expect(stageGroups).toHaveLength(2);
    const persisted = await new DrizzleDrawRepository(
      db,
    ).listGroupEntriesByStageId(stage.id);
    expect(persisted).toHaveLength(8);

    const confirmAudits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "draw.confirm"));
    expect(confirmAudits.length).toBeGreaterThanOrEqual(1);

    await expect(
      draws.generateDraw(operator, {
        eventId: event.id,
        stageId: stage.id,
        configuration: {
          seedDistribution: "NORMAL",
          avoidSameClub: true,
          groupCount,
          capacityPerGroup: capacity,
        },
        randomSeed: 1,
      }),
    ).rejects.toBeInstanceOf(DomainStateError);
  });

  it("supports 32 entries / 8 groups draw when feasible", async () => {
    const { event, stage } = await seedGroupEvent({
      entryCount: 32,
      groupCount: 8,
      capacity: 4,
    });
    const draws = new DrawService(db);
    const result = await draws.generateDraw(admin, {
      eventId: event.id,
      stageId: stage.id,
      configuration: {
        seedDistribution: "SERPENTINE",
        avoidSameClub: false,
        groupCount: 8,
        capacityPerGroup: 4,
      },
      randomSeed: "fixture-32",
    });
    expect(result.groups).toHaveLength(8);
    expect(result.results).toHaveLength(32);
    const byGroup = new Map<string, number>();
    for (const row of result.results) {
      byGroup.set(row.groupId, (byGroup.get(row.groupId) ?? 0) + 1);
    }
    expect([...byGroup.values()].every((n) => n === 4)).toBe(true);
  });

  it("generates round-robin matches with rule snapshot and is idempotent", async () => {
    const { event, stage, groupCount, capacity, rule } = await seedGroupEvent({
      entryCount: 8,
      groupCount: 2,
      capacity: 4,
    });
    const draws = new DrawService(db);
    const matchGen = new MatchGenerationService(db);

    const draw = await draws.generateDraw(admin, {
      eventId: event.id,
      stageId: stage.id,
      configuration: {
        seedDistribution: "NORMAL",
        avoidSameClub: false,
        groupCount,
        capacityPerGroup: capacity,
      },
      randomSeed: 7,
    });
    await draws.confirmDraw(admin, { drawSessionId: draw.session.id });

    // 2 groups × C(4,2) = 2 × 6 = 12 matches
    const first = await matchGen.generateRoundRobinMatches(operator, {
      eventId: event.id,
      stageId: stage.id,
    });
    expect(first.created).toBe(12);
    expect(first.skippedExisting).toBe(0);
    expect(first.eventAdvanced).toBe(true);
    expect(first.stageActivated).toBe(true);

    const eventAfter = await new EventService(db).getById(event.id);
    expect(eventAfter.status).toBe("IN_PROGRESS");
    const stageAfter = await new StageService(db).getById(stage.id);
    expect(stageAfter.status).toBe("ACTIVE");

    const snapshot = JSON.parse(first.matches[0]!.ruleSnapshotJson) as {
      bestOfSets: number;
      pointsToWin: number;
      name?: string;
    };
    expect(snapshot.bestOfSets).toBe(1);
    expect(snapshot.pointsToWin).toBe(21);
    expect(snapshot.name).toBe(rule.name);

    const retry = await matchGen.generateRoundRobinMatches(operator, {
      eventId: event.id,
      stageId: stage.id,
    });
    expect(retry.created).toBe(0);
    expect(retry.skippedExisting).toBe(12);
    expect(retry.eventAdvanced).toBe(false);

    const all = await db.select().from(matches).where(eq(matches.stageId, stage.id));
    expect(all).toHaveLength(12);
    expect(new Set(all.map((m) => m.generationKey)).size).toBe(12);
  });

  it("blocks match generation before draw confirm and forbids viewers", async () => {
    const { event, stage, groupCount, capacity } = await seedGroupEvent();
    const draws = new DrawService(db);
    const matchGen = new MatchGenerationService(db);

    await expect(
      matchGen.generateRoundRobinMatches(admin, {
        eventId: event.id,
        stageId: stage.id,
      }),
    ).rejects.toBeInstanceOf(DomainStateError);

    await expect(
      draws.generateDraw(viewer, {
        eventId: event.id,
        stageId: stage.id,
        configuration: {
          seedDistribution: "NORMAL",
          avoidSameClub: false,
          groupCount,
          capacityPerGroup: capacity,
        },
        randomSeed: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admin reset clears matches for regeneration", async () => {
    const { event, stage, groupCount, capacity } = await seedGroupEvent();
    const draws = new DrawService(db);
    const matchGen = new MatchGenerationService(db);

    const draw = await draws.generateDraw(admin, {
      eventId: event.id,
      stageId: stage.id,
      configuration: {
        seedDistribution: "NORMAL",
        avoidSameClub: false,
        groupCount,
        capacityPerGroup: capacity,
      },
      randomSeed: 3,
    });
    await draws.confirmDraw(admin, { drawSessionId: draw.session.id });
    await matchGen.generateRoundRobinMatches(admin, {
      eventId: event.id,
      stageId: stage.id,
    });

    const reset = await matchGen.resetStageMatches(admin, {
      eventId: event.id,
      stageId: stage.id,
      reason: "Test reset",
    });
    expect(reset.deleted).toBe(12);

    const again = await matchGen.generateRoundRobinMatches(admin, {
      eventId: event.id,
      stageId: stage.id,
    });
    expect(again.created).toBe(12);
  });
});
