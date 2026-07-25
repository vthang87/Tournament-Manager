import { and, asc, count, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type {
  CreateMatchInput,
  MatchRecord,
  MatchResolution,
  MatchSet,
  MatchSlotSide,
  MatchStatus,
  MatchWithSets,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { matchSets, matches, tournamentEvents } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

export function roundRobinGenerationKey(
  stageId: string,
  groupId: string,
  entryAId: string,
  entryBId: string,
): string {
  const [a, b] =
    entryAId < entryBId ? [entryAId, entryBId] : [entryBId, entryAId];
  return `rr:${stageId}:${groupId}:${a}:${b}`;
}

function mapMatch(row: typeof matches.$inferSelect): MatchRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    stageId: row.stageId,
    groupId: row.groupId,
    roundNumber: row.roundNumber,
    bracketPosition: row.bracketPosition,
    entryAId: row.entryAId,
    entryBId: row.entryBId,
    winnerEntryId: row.winnerEntryId,
    status: row.status as MatchStatus,
    resolution: (row.resolution as MatchResolution | null) ?? null,
    ruleSnapshotJson: row.ruleSnapshotJson,
    generationKey: row.generationKey,
    courtId: row.courtId,
    scheduledAt: row.scheduledAt,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    warmupUntil: row.warmupUntil,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    nextMatchId: row.nextMatchId,
    nextMatchSlot: (row.nextMatchSlot as MatchSlotSide | null) ?? null,
    loserNextMatchId: row.loserNextMatchId,
    loserNextMatchSlot:
      (row.loserNextMatchSlot as MatchSlotSide | null) ?? null,
    isThirdPlace: row.isThirdPlace,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSet(row: typeof matchSets.$inferSelect): MatchSet {
  return {
    id: row.id,
    matchId: row.matchId,
    setNumber: row.setNumber,
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    winnerEntryId: row.winnerEntryId,
  };
}

export type MatchOutcomeUpdate = {
  status: MatchStatus;
  resolution: MatchResolution | null;
  winnerEntryId: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
};

export type MatchScheduleUpdate = {
  courtId: string | null;
  scheduledAt: string | null;
  estimatedDurationMinutes?: number | null;
  status?: MatchStatus;
  updatedAt: string;
};

export type MatchSlotUpdate = {
  entryAId?: string | null;
  entryBId?: string | null;
  winnerEntryId?: string | null;
  status?: MatchStatus;
  resolution?: MatchResolution | null;
  completedAt?: string | null;
  startedAt?: string | null;
  updatedAt: string;
};

export class DrizzleMatchRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateMatchInput): Promise<MatchRecord> {
    const now = nowIso();
    const row = {
      id: createId(),
      eventId: input.eventId,
      stageId: input.stageId,
      groupId: input.groupId ?? null,
      roundNumber: input.roundNumber ?? 0,
      bracketPosition: input.bracketPosition ?? null,
      entryAId: input.entryAId ?? null,
      entryBId: input.entryBId ?? null,
      winnerEntryId: null,
      status: input.status ?? ("PENDING" as MatchStatus),
      resolution: null,
      ruleSnapshotJson: input.ruleSnapshotJson,
      generationKey: input.generationKey ?? null,
      courtId: input.courtId ?? null,
      scheduledAt: input.scheduledAt ?? null,
      estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
      warmupUntil: null,
      startedAt: null,
      completedAt: null,
      nextMatchId: input.nextMatchId ?? null,
      nextMatchSlot: input.nextMatchSlot ?? null,
      loserNextMatchId: input.loserNextMatchId ?? null,
      loserNextMatchSlot: input.loserNextMatchSlot ?? null,
      isThirdPlace: input.isThirdPlace ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(matches).values(row);
    return mapMatch(row);
  }

  async findById(id: string): Promise<MatchRecord | null> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  async listSets(matchId: string): Promise<MatchSet[]> {
    const rows = await this.db
      .select()
      .from(matchSets)
      .where(eq(matchSets.matchId, matchId))
      .orderBy(asc(matchSets.setNumber));
    return rows.map(mapSet);
  }

  async findByIdWithSets(id: string): Promise<MatchWithSets | null> {
    const match = await this.findById(id);
    if (!match) {
      return null;
    }
    return { ...match, sets: await this.listSets(id) };
  }

  async findInProgressOnCourt(
    courtId: string,
    excludeMatchId?: string,
  ): Promise<MatchRecord | null> {
    const conditions = [
      eq(matches.courtId, courtId),
      eq(matches.status, "IN_PROGRESS"),
    ];
    if (excludeMatchId) {
      conditions.push(ne(matches.id, excludeMatchId));
    }
    const rows = await this.db
      .select()
      .from(matches)
      .where(and(...conditions))
      .limit(1);
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  /** Next pending/scheduled match already assigned to this court. */
  async findNextAssignedOnCourt(courtId: string): Promise<MatchRecord | null> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.courtId, courtId),
          inArray(matches.status, ["PENDING", "SCHEDULED"]),
        ),
      )
      .orderBy(asc(matches.scheduledAt), asc(matches.createdAt))
      .limit(1);
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  /**
   * Matches a court referee can claim/start: not yet started (PENDING/SCHEDULED),
   * both sides filled, within the tournament — including matches on other courts.
   */
  async listSelectableForCourt(
    tournamentId: string,
    courtId: string,
  ): Promise<MatchRecord[]> {
    const rows = await this.db
      .select({ match: matches })
      .from(matches)
      .innerJoin(tournamentEvents, eq(matches.eventId, tournamentEvents.id))
      .where(
        and(
          eq(tournamentEvents.tournamentId, tournamentId),
          inArray(matches.status, ["PENDING", "SCHEDULED"]),
          isNotNull(matches.entryAId),
          isNotNull(matches.entryBId),
        ),
      )
      .orderBy(
        // This court → unassigned → other courts.
        sql`CASE
          WHEN ${matches.courtId} = ${courtId} THEN 0
          WHEN ${matches.courtId} IS NULL THEN 1
          ELSE 2
        END`,
        asc(matches.scheduledAt),
        asc(matches.createdAt),
      )
      .limit(60);
    return rows.map((r) => mapMatch(r.match));
  }

  async listBusyCourtIdsForTournament(
    tournamentId: string,
    excludeMatchId?: string,
  ): Promise<string[]> {
    const conditions = [
      eq(tournamentEvents.tournamentId, tournamentId),
      eq(matches.status, "IN_PROGRESS"),
      isNotNull(matches.courtId),
    ];
    if (excludeMatchId) {
      conditions.push(ne(matches.id, excludeMatchId));
    }
    const rows = await this.db
      .select({ courtId: matches.courtId })
      .from(matches)
      .innerJoin(
        tournamentEvents,
        eq(matches.eventId, tournamentEvents.id),
      )
      .where(and(...conditions));
    return [
      ...new Set(
        rows
          .map((r) => r.courtId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
  }

  async listByStageId(stageId: string): Promise<MatchRecord[]> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(eq(matches.stageId, stageId))
      .orderBy(asc(matches.roundNumber), asc(matches.bracketPosition));
    return rows.map(mapMatch);
  }

  async listByGroupId(groupId: string): Promise<MatchRecord[]> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(eq(matches.groupId, groupId))
      .orderBy(asc(matches.roundNumber), asc(matches.createdAt));
    return rows.map(mapMatch);
  }

  async listByEventId(eventId: string): Promise<MatchRecord[]> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(eq(matches.eventId, eventId))
      .orderBy(asc(matches.scheduledAt), asc(matches.createdAt));
    return rows.map(mapMatch);
  }

  async listByIds(ids: string[]): Promise<MatchRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(matches)
      .where(inArray(matches.id, ids));
    return rows.map(mapMatch);
  }

  async findByGenerationKey(
    generationKey: string,
  ): Promise<MatchRecord | null> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(eq(matches.generationKey, generationKey))
      .limit(1);
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  async countByStageId(stageId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(matches)
      .where(eq(matches.stageId, stageId));
    return rows[0]?.value ?? 0;
  }

  async stageHasScores(stageId: string): Promise<boolean> {
    const scoredSets = await this.db
      .select({ value: count() })
      .from(matchSets)
      .innerJoin(matches, eq(matchSets.matchId, matches.id))
      .where(
        and(
          eq(matches.stageId, stageId),
          or(
            ne(matchSets.scoreA, 0),
            ne(matchSets.scoreB, 0),
            isNotNull(matchSets.winnerEntryId),
          ),
        ),
      );
    if ((scoredSets[0]?.value ?? 0) > 0) {
      return true;
    }

    const progressed = await this.db
      .select({ value: count() })
      .from(matches)
      .where(and(eq(matches.stageId, stageId), ne(matches.status, "PENDING")));
    return (progressed[0]?.value ?? 0) > 0;
  }

  async listKnockoutByStage(stageId: string): Promise<MatchRecord[]> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.stageId, stageId),
          isNotNull(matches.generationKey),
          isNull(matches.groupId),
        ),
      )
      .orderBy(asc(matches.roundNumber), asc(matches.bracketPosition));
    return rows
      .map(mapMatch)
      .filter((m) => m.generationKey != null && !m.generationKey.startsWith("rr:"));
  }

  async hasStartedKnockoutMatches(stageId: string): Promise<boolean> {
    const rows = await this.listKnockoutByStage(stageId);
    return rows.some(
      (m) =>
        m.status === "IN_PROGRESS" ||
        m.status === "COMPLETED" ||
        m.status === "WALKOVER" ||
        (m.winnerEntryId != null && !m.generationKey?.includes("BYE")),
    );
  }

  async updateOutcome(
    id: string,
    update: MatchOutcomeUpdate,
  ): Promise<MatchRecord | null> {
    await this.db
      .update(matches)
      .set({
        status: update.status,
        resolution: update.resolution,
        winnerEntryId: update.winnerEntryId,
        startedAt:
          update.startedAt !== undefined ? update.startedAt : undefined,
        completedAt:
          update.completedAt !== undefined ? update.completedAt : undefined,
        updatedAt: update.updatedAt,
      })
      .where(eq(matches.id, id));
    return this.findById(id);
  }

  async updateSlots(
    id: string,
    update: MatchSlotUpdate,
  ): Promise<MatchRecord | null> {
    await this.db
      .update(matches)
      .set({
        entryAId: update.entryAId,
        entryBId: update.entryBId,
        winnerEntryId: update.winnerEntryId,
        status: update.status,
        resolution: update.resolution,
        completedAt: update.completedAt,
        startedAt: update.startedAt,
        updatedAt: update.updatedAt,
      })
      .where(eq(matches.id, id));
    return this.findById(id);
  }

  async updateSchedule(
    id: string,
    update: MatchScheduleUpdate,
  ): Promise<MatchRecord | null> {
    await this.db
      .update(matches)
      .set({
        courtId: update.courtId,
        scheduledAt: update.scheduledAt,
        estimatedDurationMinutes: update.estimatedDurationMinutes,
        status: update.status,
        updatedAt: update.updatedAt,
      })
      .where(eq(matches.id, id));
    return this.findById(id);
  }

  async replaceSets(
    matchId: string,
    sets: Array<{
      setNumber: number;
      scoreA: number;
      scoreB: number;
      winnerEntryId: string | null;
    }>,
  ): Promise<MatchSet[]> {
    await this.db.delete(matchSets).where(eq(matchSets.matchId, matchId));
    if (sets.length === 0) {
      return [];
    }
    const rows = sets.map((set) => ({
      id: createId(),
      matchId,
      setNumber: set.setNumber,
      scoreA: set.scoreA,
      scoreB: set.scoreB,
      winnerEntryId: set.winnerEntryId,
    }));
    await this.db.insert(matchSets).values(rows);
    return rows.map(mapSet);
  }

  async deleteByStageId(stageId: string): Promise<number> {
    const stageMatches = await this.listByStageId(stageId);
    if (stageMatches.length === 0) {
      return 0;
    }
    const ids = stageMatches.map((m) => m.id);
    await this.db.delete(matchSets).where(inArray(matchSets.matchId, ids));
    const result = await this.db
      .delete(matches)
      .where(eq(matches.stageId, stageId));
    return result.changes ?? 0;
  }

  async deleteKnockoutByStage(stageId: string): Promise<number> {
    const knockout = await this.listKnockoutByStage(stageId);
    if (knockout.length === 0) {
      return 0;
    }
    const ids = knockout.map((m) => m.id);
    await this.db.delete(matchSets).where(inArray(matchSets.matchId, ids));
    let deleted = 0;
    for (const id of ids) {
      const result = await this.db.delete(matches).where(eq(matches.id, id));
      deleted += result.changes ?? 0;
    }
    return deleted;
  }
}
