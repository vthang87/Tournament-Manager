import {
  ConflictError,
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  MatchRecord,
  MatchResolution,
  MatchStatus,
  MatchWithSets,
} from "@/core/domain";
import {
  assertMatchCancellable,
  assertMatchCorrectable,
  assertMatchScoreable,
  assertMatchStartable,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import { DomainError } from "@/core/tournament-engine/errors";
import { createMatchRuleSnapshot } from "@/core/tournament-engine/match-rules/create-snapshot";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import { calculateMatchWinner } from "@/core/tournament-engine/scoring";
import { calculateSetWinner } from "@/core/tournament-engine/scoring/calculate-set-winner";
import { setsToWin as computeSetsToWin } from "@/core/tournament-engine/scoring/set-points";
import type { AppDatabase } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleCourtRepository } from "@/db/repositories/court-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { matchSets, matches } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  cancelMatchSchema,
  correctScoreSchema,
  enterScoreSchema,
  parseOrThrow,
  specialResolutionSchema,
} from "@/lib/validation/schemas";
import { and, eq } from "drizzle-orm";
import type { BracketService } from "./bracket-service";

function parseRuleSnapshot(json: string): MatchRuleSnapshot {
  try {
    return createMatchRuleSnapshot(JSON.parse(json) as MatchRuleSnapshot);
  } catch {
    throw new ValidationError(
      "Match rule snapshot is invalid",
      "INVALID_RULE_SNAPSHOT",
    );
  }
}

function mergeAuditMetadata(
  actorMeta?: Record<string, unknown>,
  optionsMeta?: unknown,
): Record<string, unknown> | undefined {
  const fromOptions =
    optionsMeta &&
    typeof optionsMeta === "object" &&
    !Array.isArray(optionsMeta)
      ? (optionsMeta as Record<string, unknown>)
      : undefined;
  if (!actorMeta && !fromOptions) {
    return undefined;
  }
  return { ...(actorMeta ?? {}), ...(fromOptions ?? {}) };
}

function statusForResolution(resolution: MatchResolution): MatchStatus {
  if (resolution === "WALKOVER" || resolution === "NO_SHOW") {
    return "WALKOVER";
  }
  return "COMPLETED";
}

type FinishPayload = {
  sets: Array<{
    setNumber: number;
    scoreA: number;
    scoreB: number;
    winnerEntryId: string | null;
  }>;
  winnerEntryId: string;
  status: MatchStatus;
  resolution: MatchResolution;
  startedAt?: string;
};

/**
 * Match operations: start, score, special resolutions, cancel, correct.
 * Winner is always derived by the scoring engine (client winner ignored).
 */
export class MatchOpsService {
  private readonly matchesRepo: DrizzleMatchRepository;
  private readonly courts: DrizzleCourtRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private bracketService: BracketService | null = null;

  constructor(private readonly db: AppDatabase) {
    this.matchesRepo = new DrizzleMatchRepository(db);
    this.courts = new DrizzleCourtRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
  }

  /** Lazy wiring to avoid circular construct-time deps. */
  setBracketService(bracket: BracketService) {
    this.bracketService = bracket;
  }

  async getById(id: string): Promise<MatchWithSets> {
    const match = await this.matchesRepo.findByIdWithSets(id);
    if (!match) {
      throw new NotFoundError(`Match ${id} not found`);
    }
    return match;
  }

  listByStage(stageId: string) {
    return this.matchesRepo.listByStageId(stageId);
  }

  listByGroup(groupId: string) {
    return this.matchesRepo.listByGroupId(groupId);
  }

  private async assertTournamentWritable(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);
    return { event, tournament };
  }

  private assertOptimisticConcurrency(
    match: MatchRecord,
    expectedUpdatedAt?: string,
  ) {
    if (expectedUpdatedAt && match.updatedAt !== expectedUpdatedAt) {
      throw new ConflictError(
        "Match was updated by another request; refresh and retry",
      );
    }
  }

  private assertBothSidesPresent(match: MatchRecord) {
    if (!match.entryAId || !match.entryBId) {
      throw new DomainStateError(
        "Match requires both entry slots to be filled",
        "MATCH_SLOTS_INCOMPLETE",
      );
    }
  }

  private computeWinner(
    match: MatchRecord,
    sets: Array<{ setNumber: number; scoreA: number; scoreB: number }>,
  ) {
    const rule = parseRuleSnapshot(match.ruleSnapshotJson);
    try {
      return calculateMatchWinner({
        sets,
        rule,
        entryIdA: match.entryAId!,
        entryIdB: match.entryBId!,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ValidationError(err.message, err.code);
      }
      throw err;
    }
  }

  async startMatch(
    actor: ActorContext,
    matchId: string,
    expectedUpdatedAt?: string,
    options?: { courtId?: string | null },
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const before = await this.getById(matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, expectedUpdatedAt);
    assertMatchStartable(before.status);
    this.assertBothSidesPresent(before);

    const courtId =
      options?.courtId !== undefined ? options.courtId : before.courtId;
    if (!courtId) {
      throw new ValidationError(
        "Assign a court before starting the match",
        "COURT_REQUIRED",
      );
    }
    const court = await this.courts.findById(courtId);
    if (!court || !court.active) {
      throw new ValidationError("Court not found or inactive", "COURT_INVALID");
    }
    const event = await this.events.findById(before.eventId);
    if (!event || court.tournamentId !== event.tournamentId) {
      throw new ValidationError(
        "Court does not belong to this tournament",
        "COURT_INVALID",
      );
    }
    const busy = await this.matchesRepo.findInProgressOnCourt(
      courtId,
      matchId,
    );
    if (busy) {
      throw new ValidationError(
        "Court already has a match in progress",
        "COURT_BUSY",
      );
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const startedAt = updatedAt;
      const changed = tx
        .update(matches)
        .set({
          status: "IN_PROGRESS",
          courtId,
          warmupUntil: null,
          startedAt,
          updatedAt,
        })
        .where(
          and(
            eq(matches.id, matchId),
            eq(matches.updatedAt, before.updatedAt),
          ),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }

      const after: MatchWithSets = {
        ...before,
        status: "IN_PROGRESS",
        courtId,
        warmupUntil: null,
        startedAt,
        updatedAt,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.start",
        entityType: "match",
        entityId: matchId,
        before,
        after,
        metadata: actor.auditMetadata,
      });
      return after;
    });
  }

  /**
   * Call the teams to court: set a pre-start countdown so players can prepare.
   * Does not start the match; the countdown is informational and cleared on start/cancel.
   */
  async callToCourt(
    actor: ActorContext,
    matchId: string,
    minutes: number,
    expectedUpdatedAt?: string,
    options?: { courtId?: string },
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const before = await this.getById(matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, expectedUpdatedAt);
    assertMatchStartable(before.status);
    this.assertBothSidesPresent(before);

    const mins = Math.min(30, Math.max(1, Math.round(minutes)));
    if (!Number.isFinite(mins)) {
      throw new ValidationError(
        "Countdown minutes must be a number",
        "WARMUP_MINUTES_INVALID",
      );
    }

    let courtId = before.courtId;
    if (options?.courtId) {
      // May reassign from another court — only allowed because match is not started
      // (assertMatchStartable above).
      const court = await this.courts.findById(options.courtId);
      if (!court || !court.active) {
        throw new ValidationError(
          "Court not found or inactive",
          "COURT_INVALID",
        );
      }
      const event = await this.events.findById(before.eventId);
      if (!event || court.tournamentId !== event.tournamentId) {
        throw new ValidationError(
          "Court does not belong to this tournament",
          "COURT_INVALID",
        );
      }
      courtId = options.courtId;
    }

    const warmupUntil = new Date(Date.now() + mins * 60_000).toISOString();

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const changed = tx
        .update(matches)
        .set({ warmupUntil, courtId, updatedAt })
        .where(
          and(eq(matches.id, matchId), eq(matches.updatedAt, before.updatedAt)),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }
      const after: MatchWithSets = {
        ...before,
        warmupUntil,
        courtId,
        updatedAt,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.call_to_court",
        entityType: "match",
        entityId: matchId,
        before,
        after,
        metadata: mergeAuditMetadata(actor.auditMetadata, {
          minutes: mins,
          warmupUntil,
        }),
      });
      return after;
    });
  }

  /** Clear a pending call-to-court countdown without starting the match. */
  async clearWarmup(
    actor: ActorContext,
    matchId: string,
    expectedUpdatedAt?: string,
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const before = await this.getById(matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, expectedUpdatedAt);

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const changed = tx
        .update(matches)
        .set({ warmupUntil: null, updatedAt })
        .where(
          and(eq(matches.id, matchId), eq(matches.updatedAt, before.updatedAt)),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }
      const after: MatchWithSets = { ...before, warmupUntil: null, updatedAt };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.clear_warmup",
        entityType: "match",
        entityId: matchId,
        before,
        after,
        metadata: actor.auditMetadata,
      });
      return after;
    });
  }

  /**
   * Swap entry A / entry B before the match starts (court side assignment).
   * Only allowed while the match is still PENDING or SCHEDULED.
   * Optional courtId claims/reassigns the match to that court.
   */
  async swapSides(
    actor: ActorContext,
    matchId: string,
    expectedUpdatedAt?: string,
    options?: { courtId?: string },
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const before = await this.getById(matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, expectedUpdatedAt);
    assertMatchStartable(before.status);
    this.assertBothSidesPresent(before);
    if (before.warmupUntil) {
      throw new DomainStateError(
        "Cannot swap sides after teams have been called to court",
        "WARMUP_ACTIVE",
      );
    }

    const entryAId = before.entryBId;
    const entryBId = before.entryAId;

    let courtId = before.courtId;
    if (options?.courtId) {
      const court = await this.courts.findById(options.courtId);
      if (!court || !court.active) {
        throw new ValidationError(
          "Court not found or inactive",
          "COURT_INVALID",
        );
      }
      const event = await this.events.findById(before.eventId);
      if (!event || court.tournamentId !== event.tournamentId) {
        throw new ValidationError(
          "Court does not belong to this tournament",
          "COURT_INVALID",
        );
      }
      courtId = options.courtId;
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const changed = tx
        .update(matches)
        .set({ entryAId, entryBId, courtId, updatedAt })
        .where(
          and(eq(matches.id, matchId), eq(matches.updatedAt, before.updatedAt)),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }
      const after: MatchWithSets = {
        ...before,
        entryAId,
        entryBId,
        courtId,
        updatedAt,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.swap_sides",
        entityType: "match",
        entityId: matchId,
        before,
        after,
        metadata: actor.auditMetadata,
      });
      return after;
    });
  }

  /**
   * Enter set scores and finish when the scoring engine marks the match complete.
   * Client-sent winnerEntryId is ignored.
   */
  async enterScore(
    actor: ActorContext,
    raw: unknown,
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const input = parseOrThrow(enterScoreSchema, raw);
    const before = await this.getById(input.matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, input.expectedUpdatedAt);
    assertMatchScoreable(before.status);
    this.assertBothSidesPresent(before);

    const outcome = this.computeWinner(before, input.sets);
    if (!outcome.isComplete || !outcome.winnerEntryId) {
      throw new ValidationError(
        "Match is not complete; submit a full winning set sequence",
        "MATCH_INCOMPLETE",
      );
    }

    return this.finishWithOutcome(actor, before, {
      sets: outcome.sets.map((s) => ({
        setNumber: s.setNumber,
        scoreA: s.scoreA,
        scoreB: s.scoreB,
        winnerEntryId: s.winnerEntryId,
      })),
      winnerEntryId: outcome.winnerEntryId,
      status: "COMPLETED",
      resolution: "NORMAL",
    });
  }

  async finishMatch(actor: ActorContext, raw: unknown): Promise<MatchWithSets> {
    return this.enterScore(actor, raw);
  }

  /**
   * Persist in-progress set scores without completing the match (for live board).
   * Incomplete current-set scores are allowed; illegal completed-set scores are rejected.
   */
  async saveLiveScore(
    actor: ActorContext,
    raw: unknown,
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const input = parseOrThrow(enterScoreSchema, raw);
    const before = await this.getById(input.matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, input.expectedUpdatedAt);
    if (before.status !== "IN_PROGRESS") {
      throw new DomainStateError(
        "Live scores can only be saved while the match is in progress",
        "MATCH_NOT_IN_PROGRESS",
      );
    }
    this.assertBothSidesPresent(before);

    const rule = parseRuleSnapshot(before.ruleSnapshotJson);
    const setsToWin = computeSetsToWin(rule.bestOfSets);
    const sorted = [...input.sets].sort((a, b) => a.setNumber - b.setNumber);
    for (let index = 0; index < sorted.length; index += 1) {
      if (sorted[index]!.setNumber !== index + 1) {
        throw new ValidationError(
          `Set numbers must be contiguous starting at 1; expected ${index + 1}`,
          "INVALID_SET_NUMBER",
        );
      }
    }

    let setsWonA = 0;
    let setsWonB = 0;
    const setRows: FinishPayload["sets"] = [];
    for (const set of sorted) {
      if (setsWonA >= setsToWin || setsWonB >= setsToWin) {
        throw new ValidationError(
          "Cannot include additional sets after a match winner is already determined",
          "EXTRA_SETS",
        );
      }
      const isDecidingSet =
        setsWonA === setsToWin - 1 && setsWonB === setsToWin - 1;
      let winnerEntryId: string | null = null;
      try {
        winnerEntryId = calculateSetWinner({
          scoreA: set.scoreA,
          scoreB: set.scoreB,
          rule,
          entryIdA: before.entryAId!,
          entryIdB: before.entryBId!,
          isDecidingSet,
        });
      } catch (err) {
        if (err instanceof DomainError) {
          throw new ValidationError(err.message, err.code);
        }
        throw err;
      }
      if (winnerEntryId === before.entryAId) {
        setsWonA += 1;
      } else if (winnerEntryId === before.entryBId) {
        setsWonB += 1;
      }
      setRows.push({
        setNumber: set.setNumber,
        scoreA: set.scoreA,
        scoreB: set.scoreB,
        winnerEntryId,
      });
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const changed = tx
        .update(matches)
        .set({ updatedAt })
        .where(
          and(
            eq(matches.id, before.id),
            eq(matches.updatedAt, before.updatedAt),
          ),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }

      await tx.delete(matchSets).where(eq(matchSets.matchId, before.id))
      const persistedSets = setRows.map((set) => {
        const id = createId();
        await tx.insert(matchSets)
          .values({
            id,
            matchId: before.id,
            setNumber: set.setNumber,
            scoreA: set.scoreA,
            scoreB: set.scoreB,
            winnerEntryId: set.winnerEntryId,
          })
          
        return {
          id,
          matchId: before.id,
          setNumber: set.setNumber,
          scoreA: set.scoreA,
          scoreB: set.scoreB,
          winnerEntryId: set.winnerEntryId,
        };
      });

      const after: MatchWithSets = {
        ...before,
        updatedAt,
        sets: persistedSets,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.live_score",
        entityType: "match",
        entityId: before.id,
        before,
        after,
        metadata: actor.auditMetadata,
      });
      return after;
    });
  }

  async resolveSpecial(
    actor: ActorContext,
    raw: unknown,
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const input = parseOrThrow(specialResolutionSchema, raw);
    const before = await this.getById(input.matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, input.expectedUpdatedAt);

    if (before.status === "CANCELLED") {
      throw new DomainStateError(
        "Cancelled match cannot be resolved",
        "MATCH_CANCELLED",
      );
    }
    if (before.status === "COMPLETED" || before.status === "WALKOVER") {
      throw new DomainStateError(
        "Match already finished",
        "MATCH_ALREADY_FINISHED",
      );
    }

    this.assertBothSidesPresent(before);
    if (
      input.winnerEntryId !== before.entryAId &&
      input.winnerEntryId !== before.entryBId
    ) {
      throw new ValidationError(
        "Winner must be one of the match participants",
        "INVALID_WINNER",
      );
    }

    let setRows: FinishPayload["sets"] = [];
    if (input.sets && input.sets.length > 0) {
      if (input.resolution === "RETIREMENT") {
        setRows = input.sets.map((s) => ({
          setNumber: s.setNumber,
          scoreA: s.scoreA,
          scoreB: s.scoreB,
          winnerEntryId: null,
        }));
      } else {
        const outcome = this.computeWinner(before, input.sets);
        setRows = outcome.sets.map((s) => ({
          setNumber: s.setNumber,
          scoreA: s.scoreA,
          scoreB: s.scoreB,
          winnerEntryId: s.winnerEntryId,
        }));
      }
    } else if (
      input.resolution === "WALKOVER" ||
      input.resolution === "NO_SHOW"
    ) {
      // Award pointsToWin–0 for each set needed to win (standings + scoreboard).
      const rule = parseRuleSnapshot(before.ruleSnapshotJson);
      const need = computeSetsToWin(rule.bestOfSets);
      const pts = rule.pointsToWin;
      const winnerIsA = input.winnerEntryId === before.entryAId;
      setRows = Array.from({ length: need }, (_, i) => ({
        setNumber: i + 1,
        scoreA: winnerIsA ? pts : 0,
        scoreB: winnerIsA ? 0 : pts,
        winnerEntryId: input.winnerEntryId,
      }));
    }

    return this.finishWithOutcome(actor, before, {
      sets: setRows,
      winnerEntryId: input.winnerEntryId,
      status: statusForResolution(input.resolution),
      resolution: input.resolution,
      startedAt: before.startedAt ?? nowIso(),
    });
  }

  async cancelMatch(
    actor: ActorContext,
    raw: unknown,
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "score");
    const input = parseOrThrow(cancelMatchSchema, raw);
    const before = await this.getById(input.matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, input.expectedUpdatedAt);
    assertMatchCancellable(before.status);

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const changed = tx
        .update(matches)
        .set({
          status: "CANCELLED",
          resolution: null,
          winnerEntryId: null,
          completedAt: updatedAt,
          updatedAt,
        })
        .where(
          and(
            eq(matches.id, input.matchId),
            eq(matches.updatedAt, before.updatedAt),
          ),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }
      await tx.delete(matchSets).where(eq(matchSets.matchId, input.matchId))

      const after: MatchWithSets = {
        ...before,
        status: "CANCELLED",
        resolution: null,
        winnerEntryId: null,
        completedAt: updatedAt,
        updatedAt,
        sets: [],
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.cancel",
        entityType: "match",
        entityId: input.matchId,
        before,
        after,
        metadata: { reason: input.reason },
      });
      return after;
    });
  }

  async correctScore(
    actor: ActorContext,
    raw: unknown,
  ): Promise<MatchWithSets> {
    assertCanPerform(actor.role, "correct");
    const input = parseOrThrow(correctScoreSchema, raw);
    const before = await this.getById(input.matchId);
    await this.assertTournamentWritable(before.eventId);
    this.assertOptimisticConcurrency(before, input.expectedUpdatedAt);
    assertMatchCorrectable(before.status);
    this.assertBothSidesPresent(before);

    const outcome = this.computeWinner(before, input.sets);
    if (!outcome.isComplete || !outcome.winnerEntryId) {
      throw new ValidationError(
        "Corrected score must complete the match",
        "MATCH_INCOMPLETE",
      );
    }

    return this.finishWithOutcome(
      actor,
      before,
      {
        sets: outcome.sets.map((s) => ({
          setNumber: s.setNumber,
          scoreA: s.scoreA,
          scoreB: s.scoreB,
          winnerEntryId: s.winnerEntryId,
        })),
        winnerEntryId: outcome.winnerEntryId,
        status: "COMPLETED",
        resolution: "NORMAL",
      },
      {
        action: "match.correct",
        metadata: { reason: input.reason },
      },
    );
  }

  private async finishWithOutcome(
    actor: ActorContext,
    before: MatchWithSets,
    payload: FinishPayload,
    options?: {
      action?: string;
      metadata?: unknown;
    },
  ): Promise<MatchWithSets> {
    const finished = this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const completedAt = updatedAt;
      const startedAt = payload.startedAt ?? before.startedAt ?? updatedAt;

      const changed = tx
        .update(matches)
        .set({
          status: payload.status,
          resolution: payload.resolution,
          winnerEntryId: payload.winnerEntryId,
          startedAt,
          completedAt,
          updatedAt,
        })
        .where(
          and(
            eq(matches.id, before.id),
            eq(matches.updatedAt, before.updatedAt),
          ),
        )
        
      if ((changed.changes ?? 0) === 0) {
        throw new ConflictError(
          "Match was updated by another request; refresh and retry",
        );
      }

      await tx.delete(matchSets).where(eq(matchSets.matchId, before.id))
      const persistedSets = payload.sets.map((set) => {
        const id = createId();
        await tx.insert(matchSets)
          .values({
            id,
            matchId: before.id,
            setNumber: set.setNumber,
            scoreA: set.scoreA,
            scoreB: set.scoreB,
            winnerEntryId: set.winnerEntryId,
          })
          
        return {
          id,
          matchId: before.id,
          setNumber: set.setNumber,
          scoreA: set.scoreA,
          scoreB: set.scoreB,
          winnerEntryId: set.winnerEntryId,
        };
      });

      const after: MatchWithSets = {
        ...before,
        status: payload.status,
        resolution: payload.resolution,
        winnerEntryId: payload.winnerEntryId,
        startedAt,
        completedAt,
        updatedAt,
        sets: persistedSets,
      };

      await writeAuditLog(tx, {
        userId: actor.userId,
        action: options?.action ?? "match.finish",
        entityType: "match",
        entityId: before.id,
        before,
        after,
        metadata: mergeAuditMetadata(actor.auditMetadata, options?.metadata),
      });

      return after;
    });

    if (
      this.bracketService &&
      finished.generationKey &&
      finished.winnerEntryId
    ) {
      await this.bracketService.advanceWinnerFromMatch(actor, finished);
    }

    return finished;
  }
}
