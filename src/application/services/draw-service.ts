import {
  ConflictError,
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  DrawResultRow,
  DrawSession,
  TournamentGroup,
} from "@/core/domain";
import {
  assertEventTransition,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import {
  generateDraw,
  validateManualDraw,
  type DrawConfiguration,
  type DrawValidation,
  type EngineWarning,
} from "@/core/tournament-engine";
import { DomainError } from "@/core/tournament-engine/errors";
import type { AppDatabase } from "@/db/client";
import { DrizzleDrawRepository } from "@/db/repositories/draw-repository";
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import {
  drawResults,
  drawSessions,
  groupEntries,
  tournamentEvents,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import {
  confirmDrawSchema,
  generateDrawSchema,
  parseOrThrow,
  saveManualDrawSchema,
  validateManualDrawSchema,
} from "@/lib/validation/schemas";
import { eq, inArray } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

export type DrawConfigurationSnapshot = DrawConfiguration & {
  groupCount: number;
  capacityPerGroup: number;
};

export type GenerateDrawResult = {
  session: DrawSession;
  groups: TournamentGroup[];
  results: DrawResultRow[];
  warnings: EngineWarning[];
  redrawn: boolean;
};

function groupLabel(index: number): { name: string; code: string } {
  const code = String.fromCharCode(65 + index);
  return { name: `Group ${code}`, code };
}

function toValidationError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new ValidationError(error.message, error.code);
  }
  throw error;
}

export class DrawService {
  private readonly draws: DrizzleDrawRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly stages: DrizzleStageRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.draws = new DrizzleDrawRepository(db);
    this.entries = new DrizzleEntryRepository(db);
    this.stages = new DrizzleStageRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.access = new TournamentAccessService(db);
  }

  async getSession(drawSessionId: string): Promise<DrawSession> {
    const session = await this.draws.findSessionById(drawSessionId);
    if (!session) {
      throw new NotFoundError(`Draw session ${drawSessionId} not found`);
    }
    return session;
  }

  async listResults(drawSessionId: string) {
    return this.draws.listResults(drawSessionId);
  }

  async listGroups(stageId: string) {
    return this.draws.listGroupsByStageId(stageId);
  }

  async listSessionsByEventId(eventId: string) {
    return this.draws.listSessionsByEventId(eventId);
  }

  async listSessionsByStageId(stageId: string) {
    return this.draws.listSessionsByStageId(stageId);
  }

  async findDraftByStageId(stageId: string) {
    return this.draws.findDraftByStageId(stageId);
  }

  async findLatestConfirmedByStageId(stageId: string) {
    return this.draws.findLatestConfirmedByStageId(stageId);
  }

  private async assertEventForDraw(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    if (event.status !== "DRAW_READY") {
      throw new DomainStateError(
        `Draw requires event status DRAW_READY (current: ${event.status})`,
        "EVENT_NOT_DRAW_READY",
      );
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);
    return event;
  }

  private async ensureGroups(
    stageId: string,
    groupCount: number,
  ): Promise<TournamentGroup[]> {
    const existing = await this.draws.listGroupsByStageId(stageId);
    if (existing.length === groupCount) {
      return existing;
    }
    if (existing.length > 0 && existing.length !== groupCount) {
      throw new ConflictError(
        `Stage already has ${existing.length} groups; expected ${groupCount}`,
        "GROUP_COUNT_MISMATCH",
      );
    }
    const defs = Array.from({ length: groupCount }, (_, index) => {
      const label = groupLabel(index);
      return { ...label, orderIndex: index };
    });
    return this.draws.createGroups(stageId, defs);
  }

  /**
   * Generate (or redraw while DRAFT) a draw for a GROUP stage.
   * Idempotent redraw replaces DRAFT session results in place.
   */
  async generateDraw(
    actor: ActorContext,
    raw: unknown,
  ): Promise<GenerateDrawResult> {
    const input = parseOrThrow(generateDrawSchema, raw);
    await this.access.assertForEvent(actor, input.eventId, "draw");
    await this.assertEventForDraw(input.eventId);

    const stage = await this.stages.findById(input.stageId);
    if (!stage || stage.eventId !== input.eventId) {
      throw new NotFoundError(`Stage ${input.stageId} not found for event`);
    }
    if (stage.format !== "GROUP") {
      throw new ValidationError(
        "Draw generation requires a GROUP stage",
        "STAGE_NOT_GROUP",
      );
    }

    const confirmed = await this.draws.findLatestConfirmedByStageId(
      input.stageId,
    );
    if (confirmed) {
      throw new DomainStateError(
        "Draw already confirmed for this stage; cannot redraw",
        "DRAW_ALREADY_CONFIRMED",
      );
    }

    const entries = (await this.entries.listByEventId(input.eventId)).filter(
      (entry) => entry.status === "ACTIVE",
    );
    const { groupCount, capacityPerGroup } = input.configuration;
    if (entries.length > groupCount * capacityPerGroup) {
      throw new ValidationError(
        `Need capacity for ${entries.length} entries but only ${groupCount * capacityPerGroup} slots`,
        "INSUFFICIENT_CAPACITY",
      );
    }
    if (entries.length < 2) {
      throw new ValidationError(
        "Need at least 2 active entries to generate a draw",
        "TOO_FEW_ENTRIES",
      );
    }

    const stageGroups = await this.ensureGroups(input.stageId, groupCount);
    const configuration: DrawConfiguration = {
      seedDistribution: input.configuration.seedDistribution,
      avoidSameClub: input.configuration.avoidSameClub,
      avoidSameTeam: input.configuration.avoidSameTeam,
      avoidSameRegion: input.configuration.avoidSameRegion,
    };
    const snapshot: DrawConfigurationSnapshot = {
      ...configuration,
      groupCount,
      capacityPerGroup,
    };

    let engineResult;
    try {
      engineResult = generateDraw({
        entries: entries.map((entry) => ({
          id: entry.id,
          seed: entry.seed,
          clubId: entry.clubId,
        })),
        groups: stageGroups.map((group) => ({
          id: group.id,
          name: group.name,
          capacity: capacityPerGroup,
        })),
        configuration,
        randomSeed: input.randomSeed,
      });
    } catch (error) {
      toValidationError(error);
    }

    const randomSeed = String(input.randomSeed);
    const existingDraft = await this.draws.findDraftByStageId(input.stageId);

    const session = await this.db.transaction(async (tx) => {
      const now = nowIso();
      let sessionId: string;
      let redrawn = false;

      if (existingDraft) {
        sessionId = existingDraft.id;
        redrawn = true;
        await tx.delete(drawResults)
          .where(eq(drawResults.drawSessionId, sessionId))
          
        await tx.update(drawSessions)
          .set({
            randomSeed,
            configurationSnapshotJson: JSON.stringify(snapshot),
            createdBy: actor.userId,
          })
          .where(eq(drawSessions.id, sessionId))
          
      } else {
        sessionId = createId();
        await tx.insert(drawSessions)
          .values({
            id: sessionId,
            eventId: input.eventId,
            stageId: input.stageId,
            randomSeed,
            configurationSnapshotJson: JSON.stringify(snapshot),
            status: "DRAFT",
            createdBy: actor.userId,
            createdAt: now,
            confirmedAt: null,
          })
          
      }

      const resultRows = engineResult.data.allocations.map((row) => ({
        drawSessionId: sessionId,
        groupId: row.groupId,
        entryId: row.entryId,
        position: row.position,
      }));
      if (resultRows.length > 0) {
        await tx.insert(drawResults).values(resultRows)
      }

      const sessionRow: DrawSession = {
        id: sessionId,
        eventId: input.eventId,
        stageId: input.stageId,
        randomSeed,
        configurationSnapshotJson: JSON.stringify(snapshot),
        status: "DRAFT",
        createdBy: actor.userId,
        createdAt: existingDraft?.createdAt ?? now,
        confirmedAt: null,
      };

      await writeAuditLog(tx, {
        userId: actor.userId,
        action: redrawn ? "draw.redraw" : "draw.generate",
        entityType: "draw_session",
        entityId: sessionId,
        after: {
          session: sessionRow,
          allocationCount: resultRows.length,
          warnings: engineResult.warnings,
        },
      });

      return { session: sessionRow, results: resultRows, redrawn };
    });

    return {
      session: session.session,
      groups: stageGroups,
      results: session.results,
      warnings: engineResult.warnings,
      redrawn: session.redrawn,
    };
  }

  async validateManualAdjustment(
    actor: ActorContext,
    raw: unknown,
  ): Promise<DrawValidation> {
    const input = parseOrThrow(validateManualDrawSchema, raw);
    await this.access.assertForDrawSession(
      actor,
      input.drawSessionId,
      "draw",
    );
    const session = await this.getSession(input.drawSessionId);
    if (session.status !== "DRAFT") {
      throw new DomainStateError(
        "Only DRAFT draw sessions can be adjusted",
        "DRAW_NOT_DRAFT",
      );
    }

    const snapshot = JSON.parse(
      session.configurationSnapshotJson,
    ) as DrawConfigurationSnapshot;
    const stageGroups = await this.draws.listGroupsByStageId(session.stageId);
    const entries = (await this.entries.listByEventId(session.eventId)).filter(
      (entry) => entry.status === "ACTIVE",
    );

    try {
      return validateManualDraw({
        allocation: input.allocation,
        entries: entries.map((entry) => ({
          id: entry.id,
          seed: entry.seed,
          clubId: entry.clubId,
        })),
        groups: stageGroups.map((group) => ({
          id: group.id,
          name: group.name,
          capacity: snapshot.capacityPerGroup,
        })),
        configuration: {
          seedDistribution: snapshot.seedDistribution,
          avoidSameClub: snapshot.avoidSameClub,
          avoidSameTeam: snapshot.avoidSameTeam,
          avoidSameRegion: snapshot.avoidSameRegion,
        },
      });
    } catch (error) {
      toValidationError(error);
    }
  }

  /**
   * Persist a validated manual allocation onto a DRAFT session.
   */
  async saveManualAdjustment(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{ session: DrawSession; results: DrawResultRow[]; validation: DrawValidation }> {
    const input = parseOrThrow(saveManualDrawSchema, raw);
    await this.access.assertForDrawSession(
      actor,
      input.drawSessionId,
      "draw",
    );
    const validation = await this.validateManualAdjustment(actor, raw);
    if (!validation.valid) {
      throw new ValidationError(
        validation.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.message)
          .join("; ") || "Manual draw has hard violations",
        "MANUAL_DRAW_INVALID",
      );
    }

    const session = await this.getSession(input.drawSessionId);
    const results = await this.db.transaction(async (tx) => {
      await tx.delete(drawResults)
        .where(eq(drawResults.drawSessionId, session.id))
        

      // Normalize missing positions per group.
      const byGroup = new Map<string, typeof input.allocation>();
      for (const row of input.allocation) {
        const list = byGroup.get(row.groupId) ?? [];
        list.push(row);
        byGroup.set(row.groupId, list);
      }
      const resultRows: DrawResultRow[] = [];
      for (const [groupId, rows] of byGroup) {
        rows.forEach((row, index) => {
          resultRows.push({
            drawSessionId: session.id,
            groupId,
            entryId: row.entryId,
            position: row.position ?? index,
          });
        });
      }
      if (resultRows.length > 0) {
        await tx.insert(drawResults).values(resultRows)
      }
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "draw.manual_adjust",
        entityType: "draw_session",
        entityId: session.id,
        after: { results: resultRows, warnings: validation.issues },
      });
      return resultRows;
    });

    return { session, results, validation };
  }

  /**
   * Confirm DRAFT → LOCKED: copy to group_entries, lock session,
   * advance event DRAW_READY → DRAW_CONFIRMED.
   */
  async confirmDraw(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{ session: DrawSession; groupEntries: number }> {
    const input = parseOrThrow(confirmDrawSchema, raw);
    await this.access.assertForDrawSession(
      actor,
      input.drawSessionId,
      "draw",
    );
    const session = await this.getSession(input.drawSessionId);
    if (session.status !== "DRAFT") {
      throw new DomainStateError(
        `Draw session is ${session.status}; only DRAFT can be confirmed`,
        "DRAW_NOT_DRAFT",
      );
    }

    const event = await this.assertEventForDraw(session.eventId);
    assertEventTransition(event.status, "DRAW_CONFIRMED");

    const results = await this.draws.listResults(session.id);
    if (results.length === 0) {
      throw new ValidationError(
        "Cannot confirm an empty draw",
        "DRAW_EMPTY",
      );
    }

    // Re-validate before lock.
    const validation = await this.validateManualAdjustment(actor, {
      drawSessionId: session.id,
      allocation: results.map((row) => ({
        groupId: row.groupId,
        entryId: row.entryId,
        position: row.position,
      })),
    });
    if (!validation.valid) {
      throw new ValidationError(
        "Draw has hard violations and cannot be confirmed",
        "DRAW_INVALID",
      );
    }

    const stageGroups = await this.draws.listGroupsByStageId(session.stageId);
    const entriesById = new Map(
      (await this.entries.listByEventId(session.eventId)).map((e) => [e.id, e]),
    );

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const groupIds = stageGroups.map((g) => g.id);
      if (groupIds.length > 0) {
        await tx.delete(groupEntries)
          .where(inArray(groupEntries.groupId, groupIds))
          
      }

      const geRows = results.map((row) => {
        const entry = entriesById.get(row.entryId);
        return {
          groupId: row.groupId,
          entryId: row.entryId,
          position: row.position,
          seedPosition: entry?.seed ?? null,
        };
      });
      if (geRows.length > 0) {
        await tx.insert(groupEntries).values(geRows)
      }

      await tx.update(drawSessions)
        .set({
          status: "LOCKED",
          confirmedAt: now,
        })
        .where(eq(drawSessions.id, session.id))
        

      await tx.update(tournamentEvents)
        .set({ status: "DRAW_CONFIRMED", updatedAt: now })
        .where(eq(tournamentEvents.id, session.eventId))
        

      const locked: DrawSession = {
        ...session,
        status: "LOCKED",
        confirmedAt: now,
      };

      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "draw.confirm",
        entityType: "draw_session",
        entityId: session.id,
        before: session,
        after: {
          session: locked,
          groupEntryCount: geRows.length,
          eventStatus: "DRAW_CONFIRMED",
        },
      });

      return { session: locked, groupEntries: geRows.length };
    });
  }

  /** Optional explicit lock after confirm (already LOCKED on confirm). */
  async lockDraw(actor: ActorContext, drawSessionId: string): Promise<DrawSession> {
    await this.access.assertForDrawSession(actor, drawSessionId, "draw");
    const session = await this.getSession(drawSessionId);
    if (session.status === "LOCKED") {
      return session;
    }
    if (session.status !== "CONFIRMED") {
      throw new DomainStateError(
        `Cannot lock draw in status ${session.status}`,
        "DRAW_NOT_CONFIRMABLE",
      );
    }
    return this.db.transaction(async (tx) => {
      await tx.update(drawSessions)
        .set({ status: "LOCKED" })
        .where(eq(drawSessions.id, drawSessionId))
        
      const locked: DrawSession = { ...session, status: "LOCKED" };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "draw.lock",
        entityType: "draw_session",
        entityId: drawSessionId,
        before: session,
        after: locked,
      });
      return locked;
    });
  }
}
