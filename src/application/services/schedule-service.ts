import {
  ConflictError,
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  MatchRecord,
  ScheduleRuleRecord,
} from "@/core/domain";
import { assertTournamentNotArchived } from "@/core/domain/state-machines";
import { DomainError } from "@/core/tournament-engine/errors";
import {
  addMinutesIso,
  generateBulkSchedule,
  validateSchedule,
  type ScheduleAssignment,
  type ScheduleConflict,
  type ScheduleCourt,
  type ScheduleMatch,
  type ScheduleRule,
} from "@/core/tournament-engine/scheduling";
import type { AppDatabase } from "@/db/client";
import { DrizzleCourtRepository } from "@/db/repositories/court-repository";
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleScheduleRuleRepository } from "@/db/repositories/schedule-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import {
  matches as matchesTable,
  tournamentEvents as tournamentEventsTable,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { nowIso } from "@/lib/id";
import {
  bulkAssignSchema,
  createScheduleRuleSchema,
  parseOrThrow,
  saveAssignmentsSchema,
  updateScheduleRuleSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

function toEngineRule(record: ScheduleRuleRecord): ScheduleRule {
  return {
    defaultMatchDurationMinutes: record.defaultMatchDurationMinutes,
    minimumRestMinutes: record.minimumRestMinutes,
    courtChangeBufferMinutes: record.courtChangeBufferMinutes,
    hardRestConflicts: record.hardRestConflicts,
  };
}

/**
 * Schedule rule CRUD, validation, and assignment persistence.
 */
export class ScheduleService {
  private readonly access: TournamentAccessService;
  private readonly scheduleRules: DrizzleScheduleRuleRepository;
  private readonly matches: DrizzleMatchRepository;
  private readonly courts: DrizzleCourtRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;

  constructor(private readonly db: AppDatabase) {
    this.access = new TournamentAccessService(db);
    this.scheduleRules = new DrizzleScheduleRuleRepository(db);
    this.matches = new DrizzleMatchRepository(db);
    this.courts = new DrizzleCourtRepository(db);
    this.entries = new DrizzleEntryRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
  }

  async createRule(
    actor: ActorContext,
    raw: unknown,
  ): Promise<ScheduleRuleRecord> {
    const input = parseOrThrow(createScheduleRuleSchema, raw);
    await this.access.assertForEvent(actor, input.eventId, "schedule");
    const event = await this.events.findById(input.eventId);
    if (!event) {
      throw new NotFoundError(`Event ${input.eventId} not found`);
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    const created = await this.scheduleRules.create({
      eventId: input.eventId,
      stageId: input.stageId ?? null,
      defaultMatchDurationMinutes: input.defaultMatchDurationMinutes,
      minimumRestMinutes: input.minimumRestMinutes,
      courtChangeBufferMinutes: input.courtChangeBufferMinutes,
      hardRestConflicts: input.hardRestConflicts,
    });

    await this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "schedule_rule.create",
        entityType: "schedule_rule",
        entityId: created.id,
        after: created,
      });
    });

    return created;
  }

  async updateRule(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<ScheduleRuleRecord> {
    const input = parseOrThrow(updateScheduleRuleSchema, raw);
    const existing = await this.scheduleRules.findById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule rule ${id} not found`);
    }
    await this.access.assertForEvent(actor, existing.eventId, "schedule");
    const updated = await this.scheduleRules.update(id, input);
    if (!updated) {
      throw new NotFoundError(`Schedule rule ${id} not found`);
    }
    await this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "schedule_rule.update",
        entityType: "schedule_rule",
        entityId: id,
        before: existing,
        after: updated,
      });
    });
    return updated;
  }

  async deleteRule(actor: ActorContext, id: string): Promise<void> {
    const existing = await this.scheduleRules.findById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule rule ${id} not found`);
    }
    await this.access.assertForEvent(actor, existing.eventId, "schedule");
    await this.scheduleRules.delete(id);
    this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "schedule_rule.delete",
        entityType: "schedule_rule",
        entityId: id,
        before: existing,
      });
    });
  }

  listRules(eventId: string) {
    return this.scheduleRules.listByEventId(eventId);
  }

  async resolveRule(
    eventId: string,
    stageId?: string | null,
  ): Promise<ScheduleRule> {
    const record = await this.scheduleRules.resolveForStage(
      eventId,
      stageId ?? null,
    );
    if (record) {
      return toEngineRule(record);
    }
    return {
      defaultMatchDurationMinutes: 45,
      minimumRestMinutes: 15,
      courtChangeBufferMinutes: 5,
      hardRestConflicts: false,
    };
  }

  private async buildEntryPlayerIds(
    matchRows: MatchRecord[],
  ): Promise<Record<string, string[]>> {
    const entryIds = new Set<string>();
    for (const m of matchRows) {
      if (m.entryAId) entryIds.add(m.entryAId);
      if (m.entryBId) entryIds.add(m.entryBId);
    }
    const map: Record<string, string[]> = {};
    for (const entryId of entryIds) {
      const members = await this.entries.listMembers(entryId);
      map[entryId] = members.map((m) => m.playerId);
    }
    return map;
  }

  async validateSchedule(
    eventId: string,
    assignments: ScheduleAssignment[],
    options?: { stageId?: string | null },
  ): Promise<ScheduleConflict[]> {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const matchRows = await this.matches.listByEventId(eventId);
    const courts = await this.courts.listByTournamentId(event.tournamentId);
    const rule = await this.resolveRule(eventId, options?.stageId);

    const scheduleMatches: ScheduleMatch[] = matchRows.map((m) => ({
      id: m.id,
      entryAId: m.entryAId,
      entryBId: m.entryBId,
      estimatedDurationMinutes: m.estimatedDurationMinutes,
    }));
    const scheduleCourts: ScheduleCourt[] = courts.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
    }));
    const entryPlayerIds = await this.buildEntryPlayerIds(matchRows);

    try {
      return validateSchedule({
        matches: scheduleMatches,
        assignments,
        courts: scheduleCourts,
        rule,
        entryPlayerIds,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new ValidationError(err.message, err.code);
      }
      throw err;
    }
  }

  async saveAssignments(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{
    updated: MatchRecord[];
    conflicts: ScheduleConflict[];
  }> {
    const input = parseOrThrow(saveAssignmentsSchema, raw);
    await this.access.assertForEvent(actor, input.eventId, "schedule");
    const event = await this.events.findById(input.eventId);
    if (!event) {
      throw new NotFoundError(`Event ${input.eventId} not found`);
    }
    if (event.scheduleLockedAt) {
      throw new DomainStateError(
        "Schedule is locked and can no longer be changed",
        "SCHEDULE_LOCKED",
      );
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    const assignments: ScheduleAssignment[] = input.assignments.map((a) => ({
      matchId: a.matchId,
      courtId: a.courtId,
      startTime: a.startTime,
      endTime: a.endTime,
    }));

    // Merge with existing scheduled matches not in this batch.
    const allMatches = await this.matches.listByEventId(input.eventId);
    const matchById = new Map(allMatches.map((match) => [match.id, match]));
    for (const assignment of input.assignments) {
      const match = matchById.get(assignment.matchId);
      if (!match) {
        throw new ValidationError(
          `Match ${assignment.matchId} does not belong to this event`,
          "SCHEDULE_MATCH_INVALID",
        );
      }
      if (!["PENDING", "SCHEDULED"].includes(match.status)) {
        throw new DomainStateError(
          `Match ${assignment.matchId} is ${match.status} and cannot be rescheduled`,
          "MATCH_SCHEDULE_IMMUTABLE",
        );
      }
      if (!match.entryAId || !match.entryBId) {
        throw new DomainStateError(
          `Match ${assignment.matchId} does not have both participants yet`,
          "MATCH_PARTICIPANTS_PENDING",
        );
      }
    }
    const batchIds = new Set(assignments.map((a) => a.matchId));
    const merged: ScheduleAssignment[] = [...assignments];
    for (const m of allMatches) {
      if (batchIds.has(m.id)) continue;
      if (m.courtId && m.scheduledAt) {
        merged.push({
          matchId: m.id,
          courtId: m.courtId,
          startTime: m.scheduledAt,
        });
      }
    }

    const conflicts = await this.validateSchedule(input.eventId, merged);
    const hard = conflicts.filter((c) => c.severity === "error");
    if (hard.length > 0) {
      throw new ConflictError(
        `Schedule has ${hard.length} hard conflict(s): ${hard.map((c) => c.code).join(", ")}`,
      );
    }

    const updated: MatchRecord[] = [];
    const now = nowIso();
    await this.db.transaction(async (tx) => {
      for (const assignment of input.assignments) {
        const durationOverride = input.assignments.find(
          (a) => a.matchId === assignment.matchId,
        )?.estimatedDurationMinutes;
        await tx.update(matchesTable)
          .set({
            courtId: assignment.courtId,
            scheduledAt: assignment.startTime,
            estimatedDurationMinutes:
              durationOverride !== undefined ? durationOverride : undefined,
            status: "SCHEDULED",
            updatedAt: now,
          })
          .where(eq(matchesTable.id, assignment.matchId))
          
      }
      if (input.restMinutes !== undefined) {
        await tx
          .update(tournamentEventsTable)
          .set({ scheduleRestMinutes: input.restMinutes, updatedAt: now })
          .where(eq(tournamentEventsTable.id, input.eventId));
      }
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "schedule.save_assignments",
        entityType: "event",
        entityId: input.eventId,
        after: {
          assignments: input.assignments,
          restMinutes: input.restMinutes,
        },
        metadata: { warnings: conflicts.filter((c) => c.severity === "warning") },
      });
    });

    for (const a of input.assignments) {
      const match = await this.matches.findById(a.matchId);
      if (match) updated.push(match);
    }

    return { updated, conflicts };
  }

  async lockSchedule(
    actor: ActorContext,
    eventId: string,
  ): Promise<{
    lockedAt: string;
    conflicts: ScheduleConflict[];
  }> {
    await this.access.assertForEvent(actor, eventId, "schedule");
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    if (event.scheduleLockedAt) {
      return { lockedAt: event.scheduleLockedAt, conflicts: [] };
    }

    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    const matchRows = await this.matches.listByEventId(eventId);
    if (
      matchRows.length === 0 ||
      matchRows.some((match) => !match.courtId || !match.scheduledAt)
    ) {
      throw new ConflictError(
        "Every match must be scheduled before the schedule can be locked",
        "SCHEDULE_INCOMPLETE",
      );
    }

    const assignments = matchRows.map((match) => ({
      matchId: match.id,
      courtId: match.courtId!,
      startTime: match.scheduledAt!,
    }));
    const conflicts = await this.validateSchedule(eventId, assignments);
    const hard = conflicts.filter((conflict) => conflict.severity === "error");
    if (hard.length > 0) {
      throw new ConflictError(
        `Schedule has ${hard.length} hard conflict(s) and cannot be locked`,
        "SCHEDULE_HAS_CONFLICTS",
      );
    }

    const lockedAt = nowIso();
    await this.db.transaction(async (tx) => {
      await tx
        .update(tournamentEventsTable)
        .set({ scheduleLockedAt: lockedAt, updatedAt: lockedAt })
        .where(eq(tournamentEventsTable.id, eventId));
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "schedule.lock",
        entityType: "event",
        entityId: eventId,
        before: { scheduleLockedAt: null },
        after: { scheduleLockedAt: lockedAt },
        metadata: {
          warnings: conflicts.filter(
            (conflict) => conflict.severity === "warning",
          ),
        },
      });
    });

    return { lockedAt, conflicts };
  }

  /**
   * Rebuild the full event schedule in parallel court waves.
   */
  async bulkAssign(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{
    updated: MatchRecord[];
    conflicts: ScheduleConflict[];
  }> {
    const input = parseOrThrow(bulkAssignSchema, raw);
    await this.access.assertForEvent(actor, input.eventId, "schedule");
    const slotMinutes = input.matchDurationMinutes + input.restMinutes;

    const matchRows = await this.matches.listByEventId(input.eventId);
    const matchById = new Map(matchRows.map((match) => [match.id, match]));
    for (const matchId of input.matchIds) {
      const match = matchById.get(matchId);
      if (!match || match.stageId !== input.stageId) {
        throw new ValidationError(
          `Match ${matchId} does not belong to the selected stage`,
          "SCHEDULE_STAGE_MATCH_INVALID",
        );
      }
      if (!["PENDING", "SCHEDULED"].includes(match.status)) {
        throw new DomainStateError(
          `Match ${matchId} is ${match.status} and cannot be rescheduled`,
          "MATCH_SCHEDULE_IMMUTABLE",
        );
      }
      if (!match.entryAId || !match.entryBId) {
        throw new DomainStateError(
          `Match ${matchId} does not have both participants yet`,
          "MATCH_PARTICIPANTS_PENDING",
        );
      }
    }
    const entryPlayerIds = await this.buildEntryPlayerIds(matchRows);
    const assignments = generateBulkSchedule({
      matches: matchRows.map((match) => ({
        id: match.id,
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        estimatedDurationMinutes: match.estimatedDurationMinutes,
      })),
      matchIds: input.matchIds,
      courtIds: input.courtIds,
      startTime: input.startTime,
      slotMinutes,
      entryPlayerIds,
    });

    const result = await this.saveAssignments(actor, {
      eventId: input.eventId,
      restMinutes: input.restMinutes,
      assignments: assignments.map((assignment) => ({
        ...assignment,
        endTime: addMinutesIso(
          assignment.startTime,
          input.matchDurationMinutes,
        ),
        estimatedDurationMinutes: input.matchDurationMinutes,
      })),
    });
    return result;
  }
}
