import {
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  MatchRecord,
  MatchSlotSide,
  MatchWithSets,
  QualificationRuleRecord,
} from "@/core/domain";
import { assertTournamentNotArchived } from "@/core/domain/state-machines";
import {
  advanceWinner,
  generateBracket,
  type Bracket,
  type BracketMatch,
  type BracketPlacementRule,
  type ByeAssignment,
} from "@/core/tournament-engine/bracket";
import { DomainError } from "@/core/tournament-engine/errors";
import { createMatchRuleSnapshot } from "@/core/tournament-engine/match-rules/create-snapshot";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import {
  resolveQualification,
  type Qualifier,
  type QualificationRule,
} from "@/core/tournament-engine/qualification";
import {
  standingCriterionSchema,
  type StandingCriterion,
} from "@/core/tournament-engine/standings";
import type { EngineWarning } from "@/core/tournament-engine/types";
import type { AppDatabase } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleMatchRuleRepository } from "@/db/repositories/match-rule-repository";
import { DrizzleQualificationRuleRepository } from "@/db/repositories/schedule-repository";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { matches as matchesTable } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  adminResetBracketSchema,
  createQualificationRuleSchema,
  generateBracketSchema,
  parseOrThrow,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { StandingsService } from "./standings-service";

function generationKeyFor(stageId: string, engineMatchId: string): string {
  return `${stageId}:${engineMatchId}`;
}

function engineIdFromKey(generationKey: string, stageId: string): string {
  const prefix = `${stageId}:`;
  return generationKey.startsWith(prefix)
    ? generationKey.slice(prefix.length)
    : generationKey;
}

function toQualificationRule(
  record: QualificationRuleRecord,
): QualificationRule {
  let rankingCriteria: StandingCriterion[] | undefined;
  if (record.rankingCriteriaJson) {
    const parsed = JSON.parse(record.rankingCriteriaJson) as unknown;
    if (Array.isArray(parsed)) {
      rankingCriteria = parsed.map((c) => standingCriterionSchema.parse(c));
    }
  }
  return {
    topPerGroup: record.topPerGroup,
    bestAdditionalEntries: record.bestAdditionalEntries,
    additionalFromRank: record.additionalFromRank ?? undefined,
    rankingCriteria,
  };
}

function knockoutHasRealPlay(existing: MatchRecord[]): boolean {
  return existing.some((m) => {
    if (
      m.status === "IN_PROGRESS" ||
      m.status === "WALKOVER" ||
      m.status === "CANCELLED"
    ) {
      return true;
    }
    if (m.status === "COMPLETED" && m.resolution === "NORMAL") {
      return true;
    }
    // Completed special resolution counts as real play.
    if (m.status === "COMPLETED" && m.resolution != null) {
      return true;
    }
    return false;
  });
}

/**
 * Qualification resolution + knockout bracket persistence / advance.
 */
export class BracketService {
  private readonly matches: DrizzleMatchRepository;
  private readonly stages: DrizzleStageRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly matchRules: DrizzleMatchRuleRepository;
  private readonly qualificationRules: DrizzleQualificationRuleRepository;
  private readonly standings: StandingsService;

  constructor(private readonly db: AppDatabase) {
    this.matches = new DrizzleMatchRepository(db);
    this.stages = new DrizzleStageRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.matchRules = new DrizzleMatchRuleRepository(db);
    this.qualificationRules = new DrizzleQualificationRuleRepository(db);
    this.standings = new StandingsService(db);
  }

  async createQualificationRule(
    actor: ActorContext,
    raw: unknown,
  ): Promise<QualificationRuleRecord> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(createQualificationRuleSchema, raw);
    const source = await this.stages.findById(input.sourceStageId);
    const target = await this.stages.findById(input.targetStageId);
    if (!source || !target) {
      throw new NotFoundError("Source or target stage not found");
    }
    if (source.format !== "GROUP" || target.format !== "KNOCKOUT") {
      throw new ValidationError(
        "Qualification requires GROUP → KNOCKOUT stages",
      );
    }

    const rankingCriteriaJson = input.rankingCriteria
      ? JSON.stringify(
          input.rankingCriteria.map((c) => standingCriterionSchema.parse(c)),
        )
      : null;

    const created = await this.qualificationRules.create({
      sourceStageId: input.sourceStageId,
      targetStageId: input.targetStageId,
      topPerGroup: input.topPerGroup,
      bestAdditionalEntries: input.bestAdditionalEntries ?? 0,
      additionalFromRank: input.additionalFromRank ?? null,
      rankingCriteriaJson,
    });

    await this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "qualification_rule.create",
        entityType: "qualification_rule",
        entityId: created.id,
        after: created,
      });
    });

    return created;
  }

  async resolveQualification(
    actor: ActorContext,
    sourceStageId: string,
    targetStageId?: string,
  ): Promise<{ qualifiers: Qualifier[]; rule: QualificationRule }> {
    assertCanPerform(actor.role, "draw");
    const ruleRecord = targetStageId
      ? await this.qualificationRules.findByStages(sourceStageId, targetStageId)
      : await this.qualificationRules.findBySourceStage(sourceStageId);
    if (!ruleRecord) {
      throw new NotFoundError("Qualification rule not found for stages");
    }
    const rule = toQualificationRule(ruleRecord);
    const standingsByGroup =
      await this.standings.calculateForStage(sourceStageId);

    try {
      const result = resolveQualification({
        standingsByGroup: standingsByGroup.map((s) => ({
          groupId: s.groupId!,
          standings: s.rows,
        })),
        rule,
      });
      return { qualifiers: result.qualifiers, rule };
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ValidationError(err.message, err.code);
      }
      throw err;
    }
  }

  private async resolveRuleSnapshot(
    eventId: string,
    stageId: string,
  ): Promise<MatchRuleSnapshot> {
    const stageRule = await this.stages.getStageRule(stageId);
    if (stageRule) {
      const rule = await this.matchRules.findById(stageRule.matchRuleId);
      if (rule) {
        return createMatchRuleSnapshot(rule);
      }
    }
    const event = await this.events.findById(eventId);
    if (event?.defaultMatchRuleId) {
      const rule = await this.matchRules.findById(event.defaultMatchRuleId);
      if (rule) {
        return createMatchRuleSnapshot(rule);
      }
    }
    throw new ValidationError(
      "No match rule available for knockout stage",
      "MISSING_MATCH_RULE",
    );
  }

  private async assertWritable(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);
    return event;
  }

  async generateBracket(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{
    matches: MatchRecord[];
    qualifiers: Qualifier[];
    warnings: EngineWarning[];
  }> {
    assertCanPerform(actor.role, "draw");
    const input = parseOrThrow(generateBracketSchema, raw);
    const source = await this.stages.findById(input.sourceStageId);
    const target = await this.stages.findById(input.targetStageId);
    if (!source || !target) {
      throw new NotFoundError("Source or target stage not found");
    }
    if (target.format !== "KNOCKOUT") {
      throw new ValidationError("Target stage must be KNOCKOUT");
    }
    await this.assertWritable(target.eventId);

    const existing = await this.matches.listKnockoutByStage(target.id);
    if (existing.length > 0) {
      if (knockoutHasRealPlay(existing)) {
        throw new DomainStateError(
          "Cannot regenerate bracket after knockout has started; use adminResetBracket",
          "BRACKET_STARTED",
        );
      }
      await this.matches.deleteKnockoutByStage(target.id);
    }

    const { qualifiers } = await this.resolveQualification(
      actor,
      input.sourceStageId,
      input.targetStageId,
    );

    const event = await this.events.findById(target.eventId);
    const thirdPlaceEnabled =
      input.thirdPlaceEnabled ?? event?.thirdPlaceMatchEnabled ?? false;

    let engineResult;
    try {
      engineResult = generateBracket({
        qualifiers,
        bracketSize: input.bracketSize,
        placementRule:
          (input.placementRule as BracketPlacementRule | undefined) ??
          "BY_QUALIFICATION_SEED",
        byeAssignment: input.byeAssignment as ByeAssignment | undefined,
        thirdPlaceEnabled,
        avoidSameGroupRoundOne: input.avoidSameGroupRoundOne ?? true,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ValidationError(err.message, err.code);
      }
      throw err;
    }

    const snapshot = await this.resolveRuleSnapshot(target.eventId, target.id);
    const snapshotJson = JSON.stringify(snapshot);
    const engineBracket = engineResult.data;

    const idMap = new Map<string, string>();
    for (const em of engineBracket.matches) {
      idMap.set(em.id, createId());
    }

    const created: MatchRecord[] = [];
    await this.db.transaction(async (tx) => {
      const now = nowIso();
      for (const em of engineBracket.matches) {
        const id = idMap.get(em.id)!;
        const nextId = em.nextMatchId ? (idMap.get(em.nextMatchId) ?? null) : null;
        const loserNextId = em.loserNextMatchId
          ? (idMap.get(em.loserNextMatchId) ?? null)
          : null;
        const isByeComplete =
          em.winnerEntryId != null && (em.slotA.isBye || em.slotB.isBye);

        const row = {
          id,
          eventId: target.eventId,
          stageId: target.id,
          groupId: null as string | null,
          roundNumber: em.roundIndex,
          bracketPosition: em.matchIndex,
          entryAId: em.slotA.entryId,
          entryBId: em.slotB.entryId,
          winnerEntryId: em.winnerEntryId,
          status: (isByeComplete ? "COMPLETED" : "PENDING") as MatchRecord["status"],
          resolution: null as MatchRecord["resolution"],
          ruleSnapshotJson: snapshotJson,
          generationKey: generationKeyFor(target.id, em.id),
          courtId: null as string | null,
          scheduledAt: null as string | null,
          estimatedDurationMinutes: null as number | null,
          warmupUntil: null as string | null,
          startedAt: null as string | null,
          completedAt: isByeComplete ? now : null,
          nextMatchId: nextId,
          nextMatchSlot: em.nextMatchSlot as MatchSlotSide | null,
          loserNextMatchId: loserNextId,
          loserNextMatchSlot: em.loserNextMatchSlot as MatchSlotSide | null,
          isThirdPlace: em.isThirdPlace,
          createdAt: now,
          updatedAt: now,
        };
        await tx.insert(matchesTable).values(row)
        created.push(row);
      }

      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "bracket.generate",
        entityType: "stage",
        entityId: target.id,
        after: {
          matchCount: created.length,
          bracketSize: input.bracketSize,
          qualifierCount: qualifiers.length,
        },
        metadata: { warnings: engineResult.warnings },
      });
    });

    return {
      matches: created,
      qualifiers,
      warnings: engineResult.warnings,
    };
  }

  async loadBracket(stageId: string): Promise<Bracket> {
    const stageMatches = await this.matches.listKnockoutByStage(stageId);
    if (stageMatches.length === 0) {
      throw new NotFoundError(`No bracket matches for stage ${stageId}`);
    }

    const byId = new Map(stageMatches.map((m) => [m.id, m]));
    const engineMatches: BracketMatch[] = stageMatches.map((m) => {
      const engineId = engineIdFromKey(m.generationKey!, stageId);
      const nextKey = m.nextMatchId
        ? byId.get(m.nextMatchId)?.generationKey
        : null;
      const loserKey = m.loserNextMatchId
        ? byId.get(m.loserNextMatchId)?.generationKey
        : null;
      return {
        id: engineId,
        roundIndex: m.roundNumber,
        matchIndex: m.bracketPosition ?? 0,
        slotA: {
          entryId: m.entryAId,
          isBye: m.entryAId == null && m.winnerEntryId != null,
        },
        slotB: {
          entryId: m.entryBId,
          isBye: m.entryBId == null && m.winnerEntryId != null,
        },
        winnerEntryId: m.winnerEntryId,
        nextMatchId: nextKey ? engineIdFromKey(nextKey, stageId) : null,
        nextMatchSlot: m.nextMatchSlot,
        loserNextMatchId: loserKey
          ? engineIdFromKey(loserKey, stageId)
          : null,
        loserNextMatchSlot: m.loserNextMatchSlot,
        isThirdPlace: m.isThirdPlace,
      };
    });

    const roundCount =
      Math.max(...engineMatches.map((m) => m.roundIndex), 0) + 1;
    const r1 = engineMatches.filter(
      (m) => m.roundIndex === 0 && !m.isThirdPlace,
    );

    return {
      bracketSize: r1.length * 2,
      roundCount,
      matches: engineMatches,
      thirdPlaceEnabled: engineMatches.some((m) => m.isThirdPlace),
    };
  }

  /**
   * Advance winner into next match slots. Idempotent for retries.
   */
  async advanceWinnerFromMatch(
    actor: ActorContext,
    completed: MatchWithSets,
  ): Promise<{ warnings: EngineWarning[] }> {
    if (!completed.generationKey || !completed.winnerEntryId || completed.groupId) {
      return { warnings: [] };
    }

    const stageId = completed.stageId;
    const bracket = await this.loadBracket(stageId);
    const engineMatchId = engineIdFromKey(completed.generationKey, stageId);

    let update;
    try {
      update = advanceWinner({
        bracket,
        completedMatch: {
          matchId: engineMatchId,
          winnerEntryId: completed.winnerEntryId,
        },
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ValidationError(err.message, err.code);
      }
      throw err;
    }

    const stageMatches = await this.matches.listKnockoutByStage(stageId);
    const byEngineId = new Map(
      stageMatches.map((m) => [
        engineIdFromKey(m.generationKey!, stageId),
        m,
      ]),
    );

    const now = nowIso();
    await this.db.transaction(async (tx) => {
      for (const em of update.bracket.matches) {
        const dbMatch = byEngineId.get(em.id);
        if (!dbMatch) {
          continue;
        }
        const entryAChanged = dbMatch.entryAId !== em.slotA.entryId;
        const entryBChanged = dbMatch.entryBId !== em.slotB.entryId;
        const winnerChanged = dbMatch.winnerEntryId !== em.winnerEntryId;
        if (!entryAChanged && !entryBChanged && !winnerChanged) {
          continue;
        }

        const isByeAuto =
          em.winnerEntryId != null &&
          !dbMatch.winnerEntryId &&
          (em.slotA.isBye || em.slotB.isBye);

        await tx.update(matchesTable)
          .set({
            entryAId: em.slotA.entryId,
            entryBId: em.slotB.entryId,
            winnerEntryId: em.winnerEntryId,
            status: isByeAuto ? "COMPLETED" : dbMatch.status,
            completedAt: isByeAuto ? now : dbMatch.completedAt,
            updatedAt: now,
          })
          .where(eq(matchesTable.id, dbMatch.id))
          
      }

      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "bracket.advance",
        entityType: "match",
        entityId: completed.id,
        after: { winnerEntryId: completed.winnerEntryId },
        metadata: { warnings: update.warnings },
      });
    });

    return { warnings: update.warnings };
  }

  async adminResetBracket(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{ deleted: number }> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(adminResetBracketSchema, raw);
    const stage = await this.stages.findById(input.stageId);
    if (!stage) {
      throw new NotFoundError(`Stage ${input.stageId} not found`);
    }
    if (stage.format !== "KNOCKOUT") {
      throw new ValidationError("Stage is not KNOCKOUT");
    }
    await this.assertWritable(stage.eventId);

    const before = await this.matches.listKnockoutByStage(stage.id);
    const deleted = await this.matches.deleteKnockoutByStage(stage.id);

    await this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "bracket.admin_reset",
        entityType: "stage",
        entityId: stage.id,
        before: { matchIds: before.map((m) => m.id) },
        metadata: { reason: input.reason, deleted },
      });
    });

    return { deleted };
  }

  /**
   * Preview qualification + bracket placement without persisting matches.
   */
  async previewBracket(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{
    qualifiers: Qualifier[];
    warnings: EngineWarning[];
    bracket: Bracket;
  }> {
    assertCanPerform(actor.role, "draw");
    const input = parseOrThrow(generateBracketSchema, raw);
    const source = await this.stages.findById(input.sourceStageId);
    const target = await this.stages.findById(input.targetStageId);
    if (!source || !target) {
      throw new NotFoundError("Source or target stage not found");
    }
    if (target.format !== "KNOCKOUT") {
      throw new ValidationError("Target stage must be KNOCKOUT");
    }

    const { qualifiers } = await this.resolveQualification(
      actor,
      input.sourceStageId,
      input.targetStageId,
    );

    const event = await this.events.findById(target.eventId);
    const thirdPlaceEnabled =
      input.thirdPlaceEnabled ?? event?.thirdPlaceMatchEnabled ?? false;

    try {
      const engineResult = generateBracket({
        qualifiers,
        bracketSize: input.bracketSize,
        placementRule:
          (input.placementRule as BracketPlacementRule | undefined) ??
          "BY_QUALIFICATION_SEED",
        byeAssignment: input.byeAssignment as ByeAssignment | undefined,
        thirdPlaceEnabled,
        avoidSameGroupRoundOne: input.avoidSameGroupRoundOne ?? true,
      });
      return {
        qualifiers,
        warnings: engineResult.warnings,
        bracket: engineResult.data,
      };
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ValidationError(err.message, err.code);
      }
      throw err;
    }
  }

  /**
   * Mark a GROUP stage COMPLETED when all of its matches are terminal.
   */
  async completeGroupStage(
    actor: ActorContext,
    stageId: string,
  ): Promise<{ stageId: string; status: "COMPLETED" }> {
    assertCanPerform(actor.role, "draw");
    const stage = await this.stages.findById(stageId);
    if (!stage) {
      throw new NotFoundError(`Stage ${stageId} not found`);
    }
    if (stage.format !== "GROUP") {
      throw new ValidationError("Only GROUP stages can be completed this way");
    }
    await this.assertWritable(stage.eventId);

    if (stage.status === "COMPLETED") {
      return { stageId: stage.id, status: "COMPLETED" };
    }
    if (stage.status !== "ACTIVE") {
      throw new DomainStateError(
        `Group stage must be ACTIVE to complete (currently ${stage.status})`,
        "STAGE_NOT_ACTIVE",
      );
    }

    const stageMatches = await this.matches.listByStageId(stage.id);
    if (stageMatches.length === 0) {
      throw new DomainStateError(
        "Cannot complete group stage with no matches",
        "NO_MATCHES",
      );
    }
    const open = stageMatches.filter(
      (m) =>
        m.status !== "COMPLETED" &&
        m.status !== "WALKOVER" &&
        m.status !== "CANCELLED",
    );
    if (open.length > 0) {
      throw new DomainStateError(
        `${open.length} group match(es) still open; finish them before completing the stage`,
        "MATCHES_OPEN",
      );
    }

    const updated = await this.stages.updateStatus(stage.id, "COMPLETED");
    if (!updated) {
      throw new NotFoundError(`Stage ${stageId} not found`);
    }

    await this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "stage.completed",
        entityType: "stage",
        entityId: stage.id,
        before: stage,
        after: updated,
      });
    });

    return { stageId: stage.id, status: "COMPLETED" };
  }

  async getQualificationRule(sourceStageId: string, targetStageId: string) {
    return this.qualificationRules.findByStages(sourceStageId, targetStageId);
  }

  async listKnockoutMatches(stageId: string) {
    return this.matches.listKnockoutByStage(stageId);
  }
}
