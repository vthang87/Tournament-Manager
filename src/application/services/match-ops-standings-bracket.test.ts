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
  BracketService,
  CourtService,
  EventService,
  MatchOpsService,
  MatchRuleService,
  ScheduleService,
  StageService,
  StandingsService,
  TournamentService,
  createMatchOpsService,
} from "@/application/services";
import type { ActorContext, MatchRecord } from "@/core/domain";
import { createMatchRuleSnapshot } from "@/core/tournament-engine/match-rules/create-snapshot";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleGroupRepository } from "@/db/repositories/schedule-repository";
import { auditLogs, entries, entryMembers, players } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { ensureActors } from "@/test/actor-users";

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-ops-"));
  return path.join(dir, "test.db");
}

const admin: ActorContext = { userId: "admin-1", role: "ADMIN" };
const operator: ActorContext = { userId: "op-1", role: "OPERATOR" };
const scorekeeper: ActorContext = { userId: "sk-1", role: "SCOREKEEPER" };
const viewer: ActorContext = { userId: "viewer-1", role: "VIEWER" };

const defaultRule = createMatchRuleSnapshot({
  bestOfSets: 3,
  pointsToWin: 11,
  winBy: 2,
  maxPoints: 15,
  deuceEnabled: true,
  decidingSetPoints: null,
  decidingSetWinBy: null,
  decidingSetMaxPoints: null,
  changeEndsEnabled: true,
  changeEndsAt: 6,
});

describe("TASK 009–013 match ops / standings / bracket / schedule", () => {
  let databasePath = "";
  let db: ReturnType<typeof createDb>["db"];
  let sqlite: ReturnType<typeof createDb>["sqlite"];

  beforeEach(async () => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
    ({ db, sqlite } = createDb(databasePath));
    await ensureActors(db, [admin, operator, scorekeeper, viewer]);
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  async function seedBase() {
    const tournament = await new TournamentService(db).create(admin, {
      name: "Ops Cup",
      slug: `ops-${createId().slice(0, 8)}`,
      timezone: "UTC",
    });
    const event = await new EventService(db).create(admin, {
      tournamentId: tournament.id,
      name: "MS",
      type: "SINGLES",
      genderCategory: "OPEN",
      thirdPlaceMatchEnabled: true,
    });
    const rule = await new MatchRuleService(db).create(admin, {
      eventId: event.id,
      name: "BO3-11",
      bestOfSets: 3,
      pointsToWin: 11,
      winBy: 2,
      maxPoints: 15,
    });
    await new EventService(db).update(admin, event.id, {
      defaultMatchRuleId: rule.id,
    });
    const groupStageResult = await new StageService(db).create(admin, {
      eventId: event.id,
      type: "GROUP",
      name: "Groups",
      orderIndex: 0,
      format: "GROUP",
      matchRuleId: rule.id,
    });
    const koStageResult = await new StageService(db).create(admin, {
      eventId: event.id,
      type: "KNOCKOUT",
      name: "KO",
      orderIndex: 1,
      format: "KNOCKOUT",
      matchRuleId: rule.id,
    });
    const court = await new CourtService(db).create(admin, {
      tournamentId: tournament.id,
      name: "Court 1",
      code: "C1",
    });
    const court2 = await new CourtService(db).create(admin, {
      tournamentId: tournament.id,
      name: "Court 2",
      code: "C2",
    });
    return {
      tournament,
      event,
      rule,
      groupStage: groupStageResult.stage,
      koStage: koStageResult.stage,
      court,
      court2,
    };
  }

  async function seedEntries(eventId: string, count: number) {
    const now = nowIso();
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const playerId = createId();
      const entryId = createId();
      await db.insert(players).values({
        id: playerId,
        name: `Player ${i + 1}`,
        displayName: `P${i + 1}`,
        gender: "UNSPECIFIED",
        dateOfBirth: null,
        phone: null,
        email: null,
        clubId: null,
        ranking: null,
        metadataJson: null,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(entries).values({
        id: entryId,
        eventId,
        displayName: `Entry ${i + 1}`,
        seed: i + 1,
        ranking: null,
        clubId: null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(entryMembers).values({
        entryId,
        playerId,
        position: 1,
      });
      ids.push(entryId);
    }
    return ids;
  }

  async function createPendingMatch(input: {
    eventId: string;
    stageId: string;
    entryAId: string;
    entryBId: string;
    groupId?: string | null;
    generationKey?: string | null;
    courtId?: string | null;
  }): Promise<MatchRecord> {
    return new DrizzleMatchRepository(db).create({
      eventId: input.eventId,
      stageId: input.stageId,
      groupId: input.groupId ?? null,
      entryAId: input.entryAId,
      entryBId: input.entryBId,
      ruleSnapshotJson: JSON.stringify(defaultRule),
      generationKey: input.generationKey ?? null,
      roundNumber: 0,
      courtId: input.courtId ?? null,
    });
  }

  it("enforces match state transitions and authorization", async () => {
    const { event, groupStage, court } = await seedBase();
    const [a, b] = await seedEntries(event.id, 2);
    const match = await createPendingMatch({
      eventId: event.id,
      stageId: groupStage.id,
      entryAId: a!,
      entryBId: b!,
      courtId: court.id,
    });
    const ops = new MatchOpsService(db);

    await expect(ops.startMatch(viewer, match.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const started = await ops.startMatch(scorekeeper, match.id);
    expect(started.status).toBe("IN_PROGRESS");

    await expect(ops.startMatch(scorekeeper, match.id)).rejects.toBeInstanceOf(
      DomainStateError,
    );

    await expect(
      ops.enterScore(scorekeeper, {
        matchId: match.id,
        sets: [{ setNumber: 1, scoreA: 11, scoreB: 5 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("scores a normal best-of-3 match and ignores client winner", async () => {
    const { event, groupStage, court } = await seedBase();
    const [a, b] = await seedEntries(event.id, 2);
    const match = await createPendingMatch({
      eventId: event.id,
      stageId: groupStage.id,
      entryAId: a!,
      entryBId: b!,
      courtId: court.id,
    });
    const ops = new MatchOpsService(db);
    await ops.startMatch(scorekeeper, match.id);

    const finished = await ops.enterScore(scorekeeper, {
      matchId: match.id,
      // client wrongly claims B won — server uses sets
      winnerEntryId: b,
      sets: [
        { setNumber: 1, scoreA: 11, scoreB: 5 },
        { setNumber: 2, scoreA: 11, scoreB: 7 },
      ],
    });

    expect(finished.status).toBe("COMPLETED");
    expect(finished.resolution).toBe("NORMAL");
    expect(finished.winnerEntryId).toBe(a);
    expect(finished.sets).toHaveLength(2);

    const logs = await db.select().from(auditLogs);
    expect(logs.some((l) => l.action === "match.finish")).toBe(true);
  });

  it("handles walkover special resolution and score correction", async () => {
    const { event, groupStage } = await seedBase();
    const [a, b] = await seedEntries(event.id, 2);
    const match = await createPendingMatch({
      eventId: event.id,
      stageId: groupStage.id,
      entryAId: a!,
      entryBId: b!,
    });
    const ops = new MatchOpsService(db);

    const wo = await ops.resolveSpecial(scorekeeper, {
      matchId: match.id,
      resolution: "WALKOVER",
      winnerEntryId: a,
    });
    expect(wo.status).toBe("WALKOVER");
    expect(wo.resolution).toBe("WALKOVER");
    expect(wo.winnerEntryId).toBe(a);
    expect(wo.sets).toHaveLength(2);
    expect(wo.sets.map((s) => [s.scoreA, s.scoreB])).toEqual([
      [11, 0],
      [11, 0],
    ]);

    await expect(
      ops.correctScore(scorekeeper, {
        matchId: match.id,
        reason: "nope",
        sets: [
          { setNumber: 1, scoreA: 11, scoreB: 0 },
          { setNumber: 2, scoreA: 11, scoreB: 0 },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const corrected = await ops.correctScore(operator, {
      matchId: match.id,
      reason: "Entered wrong walkover",
      sets: [
        { setNumber: 1, scoreA: 5, scoreB: 11 },
        { setNumber: 2, scoreA: 7, scoreB: 11 },
      ],
    });
    expect(corrected.winnerEntryId).toBe(b);
    expect(corrected.status).toBe("COMPLETED");
    expect(corrected.resolution).toBe("NORMAL");

    const logs = await db.select().from(auditLogs);
    expect(logs.some((l) => l.action === "match.correct")).toBe(true);
  });

  it("blocks stale optimistic concurrency on start", async () => {
    const { event, groupStage, court } = await seedBase();
    const [a, b] = await seedEntries(event.id, 2);
    const match = await createPendingMatch({
      eventId: event.id,
      stageId: groupStage.id,
      entryAId: a!,
      entryBId: b!,
      courtId: court.id,
    });
    const ops = new MatchOpsService(db);
    await expect(
      ops.startMatch(scorekeeper, match.id, "2000-01-01T00:00:00.000Z"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("calculates standings with tie-break traces (service smoke)", async () => {
    const { event, groupStage, court } = await seedBase();
    const [e1, e2, e3] = await seedEntries(event.id, 3);
    const groups = new DrizzleGroupRepository(db);
    const group = await groups.create({
      stageId: groupStage.id,
      name: "Group A",
      code: "A",
      orderIndex: 0,
    });
    await groups.addEntry({ groupId: group.id, entryId: e1!, position: 0 });
    await groups.addEntry({ groupId: group.id, entryId: e2!, position: 1 });
    await groups.addEntry({ groupId: group.id, entryId: e3!, position: 2 });

    const repo = new DrizzleMatchRepository(db);
    const m12 = await repo.create({
      eventId: event.id,
      stageId: groupStage.id,
      groupId: group.id,
      entryAId: e1!,
      entryBId: e2!,
      ruleSnapshotJson: JSON.stringify(defaultRule),
      roundNumber: 1,
      courtId: court.id,
    });
    const m23 = await repo.create({
      eventId: event.id,
      stageId: groupStage.id,
      groupId: group.id,
      entryAId: e2!,
      entryBId: e3!,
      ruleSnapshotJson: JSON.stringify(defaultRule),
      roundNumber: 1,
      courtId: court.id,
    });
    const m31 = await repo.create({
      eventId: event.id,
      stageId: groupStage.id,
      groupId: group.id,
      entryAId: e3!,
      entryBId: e1!,
      ruleSnapshotJson: JSON.stringify(defaultRule),
      roundNumber: 1,
      courtId: court.id,
    });

    const ops = new MatchOpsService(db);
    for (const [id, winner, loser] of [
      [m12.id, e1!, e2!],
      [m23.id, e2!, e3!],
      [m31.id, e3!, e1!],
    ] as const) {
      await ops.startMatch(scorekeeper, id);
      // reload for fresh updatedAt
      const current = await ops.getById(id);
      const aIsWinner = current.entryAId === winner;
      await ops.enterScore(scorekeeper, {
        matchId: id,
        expectedUpdatedAt: current.updatedAt,
        sets: [
          {
            setNumber: 1,
            scoreA: aIsWinner ? 11 : 5,
            scoreB: aIsWinner ? 5 : 11,
          },
          {
            setNumber: 2,
            scoreA: aIsWinner ? 11 : 7,
            scoreB: aIsWinner ? 7 : 11,
          },
        ],
      });
      void loser;
    }

    const standings = await new StandingsService(db).calculateForGroup(
      group.id,
      { eventId: event.id },
    );
    expect(standings.rows).toHaveLength(3);
    expect(standings.rows.every((r) => r.wins === 1 && r.losses === 1)).toBe(
      true,
    );
    expect(standings.rows[0]!.tieBreakTrace.length).toBeGreaterThan(0);
  });

  it("generates bracket, advances winner, and is advance-idempotent", async () => {
    const { event, groupStage, koStage, court } = await seedBase();
    // 4 entries → 2 groups of 2 → top 1 each → bracket size 2
    const entryIds = await seedEntries(event.id, 4);
    const groups = new DrizzleGroupRepository(db);
    const gA = await groups.create({
      stageId: groupStage.id,
      name: "A",
      code: "A",
      orderIndex: 0,
    });
    const gB = await groups.create({
      stageId: groupStage.id,
      name: "B",
      code: "B",
      orderIndex: 1,
    });
    await groups.addEntry({
      groupId: gA.id,
      entryId: entryIds[0]!,
      position: 0,
    });
    await groups.addEntry({
      groupId: gA.id,
      entryId: entryIds[1]!,
      position: 1,
    });
    await groups.addEntry({
      groupId: gB.id,
      entryId: entryIds[2]!,
      position: 0,
    });
    await groups.addEntry({
      groupId: gB.id,
      entryId: entryIds[3]!,
      position: 1,
    });

    const repo = new DrizzleMatchRepository(db);
    const ops = createMatchOpsService(db);

    async function finishGroupMatch(
      entryA: string,
      entryB: string,
      groupId: string,
      winner: string,
    ) {
      const m = await repo.create({
        eventId: event.id,
        stageId: groupStage.id,
        groupId,
        entryAId: entryA,
        entryBId: entryB,
        ruleSnapshotJson: JSON.stringify(defaultRule),
        roundNumber: 1,
        courtId: court.id,
      });
      await ops.startMatch(scorekeeper, m.id);
      const current = await ops.getById(m.id);
      const aWins = winner === entryA;
      await ops.enterScore(scorekeeper, {
        matchId: m.id,
        expectedUpdatedAt: current.updatedAt,
        sets: [
          {
            setNumber: 1,
            scoreA: aWins ? 11 : 3,
            scoreB: aWins ? 3 : 11,
          },
          {
            setNumber: 2,
            scoreA: aWins ? 11 : 4,
            scoreB: aWins ? 4 : 11,
          },
        ],
      });
    }

    await finishGroupMatch(entryIds[0]!, entryIds[1]!, gA.id, entryIds[0]!);
    await finishGroupMatch(entryIds[2]!, entryIds[3]!, gB.id, entryIds[2]!);

    const bracketSvc = new BracketService(db);
    await bracketSvc.createQualificationRule(admin, {
      sourceStageId: groupStage.id,
      targetStageId: koStage.id,
      topPerGroup: 1,
      bestAdditionalEntries: 0,
    });

    const generated = await bracketSvc.generateBracket(admin, {
      sourceStageId: groupStage.id,
      targetStageId: koStage.id,
      bracketSize: 2,
      thirdPlaceEnabled: false,
    });
    expect(generated.qualifiers).toHaveLength(2);
    expect(generated.matches.length).toBeGreaterThanOrEqual(1);

    const final = generated.matches.find((m) => m.roundNumber === 0)!;
    expect(final.entryAId).toBeTruthy();
    expect(final.entryBId).toBeTruthy();

    await ops.startMatch(scorekeeper, final.id, undefined, {
      courtId: court.id,
    });
    const live = await ops.getById(final.id);
    const winner = live.entryAId!;
    await ops.enterScore(scorekeeper, {
      matchId: final.id,
      expectedUpdatedAt: live.updatedAt,
      sets: [
        { setNumber: 1, scoreA: 11, scoreB: 2 },
        { setNumber: 2, scoreA: 11, scoreB: 3 },
      ],
    });

    const completed = await ops.getById(final.id);
    expect(completed.winnerEntryId).toBe(winner);

    // Idempotent advance retry
    const again = await bracketSvc.advanceWinnerFromMatch(admin, completed);
    expect(again.warnings).toEqual([]);

    await expect(
      bracketSvc.generateBracket(admin, {
        sourceStageId: groupStage.id,
        targetStageId: koStage.id,
        bracketSize: 2,
      }),
    ).rejects.toBeInstanceOf(DomainStateError);
  });

  it("blocks hard schedule court conflicts", async () => {
    const { event, groupStage, court } = await seedBase();
    const [a, b, c, d] = await seedEntries(event.id, 4);
    const m1 = await createPendingMatch({
      eventId: event.id,
      stageId: groupStage.id,
      entryAId: a!,
      entryBId: b!,
    });
    const m2 = await createPendingMatch({
      eventId: event.id,
      stageId: groupStage.id,
      entryAId: c!,
      entryBId: d!,
    });

    const schedule = new ScheduleService(db);
    await schedule.createRule(admin, {
      eventId: event.id,
      defaultMatchDurationMinutes: 60,
      minimumRestMinutes: 15,
      courtChangeBufferMinutes: 5,
    });

    await schedule.saveAssignments(admin, {
      eventId: event.id,
      assignments: [
        {
          matchId: m1.id,
          courtId: court.id,
          startTime: "2026-07-20T10:00:00.000Z",
        },
      ],
    });

    await expect(
      schedule.saveAssignments(admin, {
        eventId: event.id,
        assignments: [
          {
            matchId: m2.id,
            courtId: court.id,
            startTime: "2026-07-20T10:30:00.000Z",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
