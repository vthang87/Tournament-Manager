import {
  ConflictError,
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
import { matches as matchesTable } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { nowIso } from "@/lib/id";
import {
  bulkAssignSchema,
  createScheduleRuleSchema,
  parseOrThrow,
  saveAssignmentsSchema,
  updateScheduleRuleSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

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
  private readonly scheduleRules: DrizzleScheduleRuleRepository;
  private readonly matches: DrizzleMatchRepository;
  private readonly courts: DrizzleCourtRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;

  constructor(private readonly db: AppDatabase) {
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
    assertCanPerform(actor.role, "schedule");
    const input = parseOrThrow(createScheduleRuleSchema, raw);
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

    this.db.transaction(async (tx) => {
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
    assertCanPerform(actor.role, "schedule");
    const input = parseOrThrow(updateScheduleRuleSchema, raw);
    const existing = await this.scheduleRules.findById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule rule ${id} not found`);
    }
    const updated = await this.scheduleRules.update(id, input);
    if (!updated) {
      throw new NotFoundError(`Schedule rule ${id} not found`);
    }
    this.db.transaction(async (tx) => {
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
    assertCanPerform(actor.role, "schedule");
    const existing = await this.scheduleRules.findById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule rule ${id} not found`);
    }
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
    assertCanPerform(actor.role, "schedule");
    const input = parseOrThrow(saveAssignmentsSchema, raw);
    const event = await this.events.findById(input.eventId);
    if (!event) {
      throw new NotFoundError(`Event ${input.eventId} not found`);
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
    this.db.transaction(async (tx) => {
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
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "schedule.save_assignments",
        entityType: "event",
        entityId: input.eventId,
        after: { assignments: input.assignments },
        metadata: { warnings: conflicts.filter((c) => c.severity === "warning") },
      });
    });

    for (const a of input.assignments) {
      const match = await this.matches.findById(a.matchId);
      if (match) updated.push(match);
    }

    return { updated, conflicts };
  }

  /**
   * Simple ordered bulk assign: round-robin courts, sequential start times.
   */
  async bulkAssign(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{
    updated: MatchRecord[];
    conflicts: ScheduleConflict[];
  }> {
    assertCanPerform(actor.role, "schedule");
    const input = parseOrThrow(bulkAssignSchema, raw);
    const rule = await this.resolveRule(input.eventId);
    const gap = input.gapMinutes ?? 0;
    const duration = rule.defaultMatchDurationMinutes;

    const assignments = input.matchIds.map((matchId, index) => {
      const courtId = input.courtIds[index % input.courtIds.length]!;
      const offset = index * (duration + gap);
      const startTime = addMinutesIso(input.startTime, offset);
      return {
        matchId,
        courtId,
        startTime,
      };
    });

    return this.saveAssignments(actor, {
      eventId: input.eventId,
      assignments,
    });
  }
}
