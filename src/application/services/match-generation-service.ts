import {
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  CreateMatchInput,
  MatchRecord,
  MatchStatus,
} from "@/core/domain";
import {
  assertEventTransition,
  assertStageTransition,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import { DomainError } from "@/core/tournament-engine/errors";
import { resolveMatchRule } from "@/core/tournament-engine/match-rules";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import { generateRoundRobin } from "@/core/tournament-engine/round-robin";
import type { AppDatabase } from "@/db/client";
import { DrizzleDrawRepository } from "@/db/repositories/draw-repository";
import {
  DrizzleMatchRepository,
  roundRobinGenerationKey,
} from "@/db/repositories/match-repository";
import {
  DrizzleMatchRuleRepository,
  toEngineMatchRule,
} from "@/db/repositories/match-rule-repository";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { matchSets, matches, stages, tournamentEvents } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  generateMatchesSchema,
  parseOrThrow,
  resetMatchesSchema,
} from "@/lib/validation/schemas";
import { eq, inArray } from "drizzle-orm";

export type GenerateMatchesResult = {
  matches: MatchRecord[];
  created: number;
  skippedExisting: number;
  eventAdvanced: boolean;
  stageActivated: boolean;
};

function toValidationError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new ValidationError(error.message, error.code);
  }
  throw error;
}

export class MatchGenerationService {
  private readonly matches: DrizzleMatchRepository;
  private readonly draws: DrizzleDrawRepository;
  private readonly stages: DrizzleStageRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly rules: DrizzleMatchRuleRepository;

  constructor(private readonly db: AppDatabase) {
    this.matches = new DrizzleMatchRepository(db);
    this.draws = new DrizzleDrawRepository(db);
    this.stages = new DrizzleStageRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.rules = new DrizzleMatchRuleRepository(db);
  }

  async listByStage(stageId: string) {
    return this.matches.listByStageId(stageId);
  }

  private async resolveRuleSnapshot(
    eventId: string,
    stageId: string,
  ): Promise<MatchRuleSnapshot> {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const stageRuleLink = await this.stages.getStageRule(stageId);
    const stageRule = stageRuleLink
      ? await this.rules.findById(stageRuleLink.matchRuleId)
      : null;
    const eventDefault = event.defaultMatchRuleId
      ? await this.rules.findById(event.defaultMatchRuleId)
      : null;

    try {
      return resolveMatchRule({
        stageRule: stageRule ? toEngineMatchRule(stageRule) : null,
        eventDefaultRule: eventDefault ? toEngineMatchRule(eventDefault) : null,
      });
    } catch (error) {
      toValidationError(error);
    }
  }

  /**
   * After draw confirmed: generate round-robin matches for every group.
   * Idempotent via generation_key — retries skip existing pairs.
   */
  async generateRoundRobinMatches(
    actor: ActorContext,
    raw: unknown,
  ): Promise<GenerateMatchesResult> {
    assertCanPerform(actor.role, "draw");
    const input = parseOrThrow(generateMatchesSchema, raw);

    const event = await this.events.findById(input.eventId);
    if (!event) {
      throw new NotFoundError(`Event ${input.eventId} not found`);
    }
    if (event.status !== "DRAW_CONFIRMED" && event.status !== "IN_PROGRESS") {
      throw new DomainStateError(
        `Match generation requires DRAW_CONFIRMED (current: ${event.status})`,
        "EVENT_NOT_DRAW_CONFIRMED",
      );
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    const stage = await this.stages.findById(input.stageId);
    if (!stage || stage.eventId !== input.eventId) {
      throw new NotFoundError(`Stage ${input.stageId} not found for event`);
    }
    if (stage.format !== "GROUP") {
      throw new ValidationError(
        "Round-robin generation requires a GROUP stage",
        "STAGE_NOT_GROUP",
      );
    }

    const confirmed = await this.draws.findLatestConfirmedByStageId(
      input.stageId,
    );
    if (!confirmed) {
      throw new DomainStateError(
        "Draw must be confirmed before generating matches",
        "DRAW_NOT_CONFIRMED",
      );
    }

    if (await this.matches.stageHasScores(input.stageId)) {
      throw new DomainStateError(
        "Cannot regenerate matches: stage already has scores or progressed matches. Use admin reset.",
        "MATCHES_HAVE_SCORES",
      );
    }

    const stageGroups = await this.draws.listGroupsByStageId(input.stageId);
    if (stageGroups.length === 0) {
      throw new ValidationError("Stage has no groups", "NO_GROUPS");
    }

    const snapshot = await this.resolveRuleSnapshot(
      input.eventId,
      input.stageId,
    );
    const ruleSnapshotJson = JSON.stringify(snapshot);

    const toCreate: CreateMatchInput[] = [];
    let skippedExisting = 0;

    for (const group of stageGroups) {
      const members = await this.draws.listGroupEntriesByGroupId(group.id);
      const entryIds = members
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((m) => m.entryId);
      if (entryIds.length < 2) {
        continue;
      }

      let rounds;
      try {
        rounds = generateRoundRobin({ entryIds });
      } catch (error) {
        toValidationError(error);
      }

      for (const round of rounds) {
        for (const pair of round.pairs) {
          const generationKey = roundRobinGenerationKey(
            input.stageId,
            group.id,
            pair.entryAId,
            pair.entryBId,
          );
          const existing =
            await this.matches.findByGenerationKey(generationKey);
          if (existing) {
            skippedExisting += 1;
            continue;
          }
          toCreate.push({
            eventId: input.eventId,
            stageId: input.stageId,
            groupId: group.id,
            roundNumber: round.roundNumber,
            entryAId: pair.entryAId,
            entryBId: pair.entryBId,
            ruleSnapshotJson,
            generationKey,
            isThirdPlace: false,
          });
        }
      }
    }

    const previousCount = await this.matches.countByStageId(input.stageId);
    const shouldAdvanceEvent = event.status === "DRAW_CONFIRMED";
    const shouldActivateStage = stage.status === "PENDING";

    if (
      toCreate.length === 0 &&
      skippedExisting === 0 &&
      previousCount === 0
    ) {
      throw new ValidationError(
        "No matches could be generated from group entries",
        "NO_MATCHES_GENERATED",
      );
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const rows = toCreate.map((row) => ({
        id: createId(),
        eventId: row.eventId,
        stageId: row.stageId,
        groupId: row.groupId ?? null,
        roundNumber: row.roundNumber ?? 0,
        bracketPosition: row.bracketPosition ?? null,
        entryAId: row.entryAId ?? null,
        entryBId: row.entryBId ?? null,
        winnerEntryId: null as string | null,
        status: (row.status ?? "PENDING") as MatchStatus,
        resolution: null,
        ruleSnapshotJson: row.ruleSnapshotJson,
        generationKey: row.generationKey ?? null,
        courtId: null as string | null,
        scheduledAt: null as string | null,
        estimatedDurationMinutes: null as number | null,
        startedAt: null as string | null,
        completedAt: null as string | null,
        nextMatchId: null as string | null,
        nextMatchSlot: null,
        loserNextMatchId: null as string | null,
        loserNextMatchSlot: null,
        isThirdPlace: row.isThirdPlace ?? false,
        createdAt: now,
        updatedAt: now,
      }));

      if (rows.length > 0) {
        tx.insert(matches).values(rows).run();
      }

      const created: MatchRecord[] = rows.map((row) => ({
        ...row,
        resolution: null,
        nextMatchSlot: null,
        loserNextMatchSlot: null,
      }));

      let eventAdvanced = false;
      let stageActivated = false;
      const hasMatches =
        created.length > 0 || previousCount > 0 || skippedExisting > 0;

      if (shouldAdvanceEvent && hasMatches) {
        assertEventTransition(event.status, "IN_PROGRESS");
        tx.update(tournamentEvents)
          .set({ status: "IN_PROGRESS", updatedAt: now })
          .where(eq(tournamentEvents.id, input.eventId))
          .run();
        eventAdvanced = true;
      }

      if (shouldActivateStage && hasMatches) {
        assertStageTransition(stage.status, "ACTIVE");
        tx.update(stages)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(eq(stages.id, input.stageId))
          .run();
        stageActivated = true;
      }

      writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.generate_round_robin",
        entityType: "stage",
        entityId: input.stageId,
        after: {
          created: created.length,
          skippedExisting,
          eventAdvanced,
          stageActivated,
          ruleSnapshot: snapshot,
        },
      });

      return {
        matches: created,
        created: created.length,
        skippedExisting,
        eventAdvanced,
        stageActivated,
      };
    });
  }

  /**
   * Admin reset: delete stage matches so generation can run again.
   * Audited; supports clearing scored matches (full score UX lands in TASK 009+).
   */
  async resetStageMatches(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{ deleted: number }> {
    assertCanPerform(actor.role, "setup");
    if (actor.role !== "ADMIN") {
      throw new DomainStateError(
        "Only ADMIN can reset matches",
        "ADMIN_REQUIRED",
      );
    }
    const input = parseOrThrow(resetMatchesSchema, raw);

    const stage = await this.stages.findById(input.stageId);
    if (!stage || stage.eventId !== input.eventId) {
      throw new NotFoundError(`Stage ${input.stageId} not found for event`);
    }

    const hasScores = await this.matches.stageHasScores(input.stageId);

    return this.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(matches)
        .where(eq(matches.stageId, input.stageId))
        .all();
      const ids = existing.map((row) => row.id);
      if (ids.length > 0) {
        tx.delete(matchSets).where(inArray(matchSets.matchId, ids)).run();
        tx.delete(matches).where(eq(matches.stageId, input.stageId)).run();
      }

      writeAuditLog(tx, {
        userId: actor.userId,
        action: "match.reset_stage",
        entityType: "stage",
        entityId: input.stageId,
        metadata: {
          reason: input.reason,
          deleted: ids.length,
          hadScores: hasScores,
        },
      });

      return { deleted: ids.length };
    });
  }
}
