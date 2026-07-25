import { DomainError } from "@/core/tournament-engine/errors";
import { SchedulingErrorCode } from "./errors";
import {
  addMinutesIso,
  gapMinutes,
  intervalsOverlap,
  parseInterval,
} from "./intervals";
import { validateScheduleInputSchema } from "./schemas";
import type {
  ScheduleAssignment,
  ScheduleConflict,
  ScheduleMatch,
  TimeInterval,
  ValidateScheduleInput,
} from "./types";

type ResolvedAssignment = {
  assignment: ScheduleAssignment;
  match: ScheduleMatch;
  interval: TimeInterval;
  courtId: string;
};

function resolveAssignments(input: ValidateScheduleInput): ResolvedAssignment[] {
  const matchById = new Map(input.matches.map((match) => [match.id, match]));
  const resolved: ResolvedAssignment[] = [];

  for (const assignment of input.assignments) {
    const match = matchById.get(assignment.matchId);
    if (!match) {
      throw new DomainError(
        SchedulingErrorCode.UNKNOWN_MATCH,
        `Unknown match in assignment: ${assignment.matchId}`,
      );
    }

    const duration =
      match.estimatedDurationMinutes ??
      input.rule.defaultMatchDurationMinutes;
    const endTime =
      assignment.endTime ?? addMinutesIso(assignment.startTime, duration);

    let interval: TimeInterval;
    try {
      interval = parseInterval(assignment.startTime, endTime);
    } catch (error) {
      throw new DomainError(
        SchedulingErrorCode.INVALID_INPUT,
        error instanceof Error ? error.message : "Invalid assignment interval",
      );
    }

    resolved.push({
      assignment,
      match,
      interval,
      courtId: assignment.courtId,
    });
  }

  return resolved;
}

function entryIdsOf(match: ScheduleMatch): string[] {
  return [match.entryAId, match.entryBId].filter(
    (id): id is string => Boolean(id),
  );
}

/**
 * Validates schedule assignments and returns structured conflicts.
 * Hard conflicts: court overlap, entry overlap, player overlap, inactive court.
 * Soft (or hard via rule.hardRestConflicts): minimum rest, court-change buffer.
 */
export function validateSchedule(
  input: ValidateScheduleInput,
): ScheduleConflict[] {
  const parsed = validateScheduleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      SchedulingErrorCode.INVALID_INPUT,
      `Invalid validateSchedule input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const data = parsed.data as ValidateScheduleInput;
  const courts = new Map(data.courts.map((court) => [court.id, court]));
  const resolved = resolveAssignments(data);
  const conflicts: ScheduleConflict[] = [];
  const restSeverity = data.rule.hardRestConflicts ? "error" : "warning";

  // Inactive courts.
  for (const row of resolved) {
    const court = courts.get(row.courtId);
    if (!court) {
      throw new DomainError(
        SchedulingErrorCode.UNKNOWN_COURT,
        `Unknown court: ${row.courtId}`,
      );
    }
    if (!court.active) {
      conflicts.push({
        code: "INACTIVE_COURT",
        message: `Court ${row.courtId} is inactive.`,
        severity: "error",
        matchIds: [row.match.id],
        entityIds: [row.courtId],
      });
    }
  }

  // Availability windows (if declared for a court).
  if (data.availability && data.availability.length > 0) {
    const windowsByCourt = new Map<string, TimeInterval[]>();
    for (const window of data.availability) {
      const list = windowsByCourt.get(window.courtId) ?? [];
      list.push(parseInterval(window.startTime, window.endTime));
      windowsByCourt.set(window.courtId, list);
    }

    for (const row of resolved) {
      const windows = windowsByCourt.get(row.courtId);
      if (!windows || windows.length === 0) continue;
      const covered = windows.some(
        (window) =>
          row.interval.startMs >= window.startMs &&
          row.interval.endMs <= window.endMs,
      );
      if (!covered) {
        conflicts.push({
          code: "OUTSIDE_AVAILABILITY",
          message: `Match ${row.match.id} on court ${row.courtId} is outside declared availability.`,
          severity: "error",
          matchIds: [row.match.id],
          entityIds: [row.courtId],
        });
      }
    }
  }

  // Pairwise overlap / rest checks.
  for (let i = 0; i < resolved.length; i += 1) {
    for (let j = i + 1; j < resolved.length; j += 1) {
      const a = resolved[i]!;
      const b = resolved[j]!;

      // Court overlap.
      if (
        a.courtId === b.courtId &&
        intervalsOverlap(a.interval, b.interval)
      ) {
        conflicts.push({
          code: "COURT_OVERLAP",
          message: `Court ${a.courtId} has overlapping matches ${a.match.id} and ${b.match.id}.`,
          severity: "error",
          matchIds: [a.match.id, b.match.id],
          entityIds: [a.courtId],
        });
      }

      const entriesA = new Set(entryIdsOf(a.match));
      const entriesB = new Set(entryIdsOf(b.match));
      const sharedEntries = [...entriesA].filter((id) => entriesB.has(id));

      if (sharedEntries.length > 0 && intervalsOverlap(a.interval, b.interval)) {
        conflicts.push({
          code: "ENTRY_OVERLAP",
          message: `Entry conflict between ${a.match.id} and ${b.match.id}.`,
          severity: "error",
          matchIds: [a.match.id, b.match.id],
          entityIds: sharedEntries,
        });
      }

      // Player overlap via membership map.
      if (data.entryPlayerIds) {
        const playersA = new Set(
          [...entriesA].flatMap((id) => data.entryPlayerIds![id] ?? []),
        );
        const playersB = new Set(
          [...entriesB].flatMap((id) => data.entryPlayerIds![id] ?? []),
        );
        const sharedPlayers = [...playersA].filter((id) => playersB.has(id));
        if (
          sharedPlayers.length > 0 &&
          intervalsOverlap(a.interval, b.interval)
        ) {
          conflicts.push({
            code: "PLAYER_OVERLAP",
            message: `Player conflict between ${a.match.id} and ${b.match.id}.`,
            severity: "error",
            matchIds: [a.match.id, b.match.id],
            entityIds: sharedPlayers,
          });
        }
      }

      // Rest / court-change for shared entries (non-overlapping ordered pair).
      if (sharedEntries.length > 0 && !intervalsOverlap(a.interval, b.interval)) {
        const [earlier, later] =
          a.interval.startMs <= b.interval.startMs ? [a, b] : [b, a];
        const gap = gapMinutes(earlier.interval, later.interval);

        if (gap < data.rule.minimumRestMinutes) {
          conflicts.push({
            code: "INSUFFICIENT_REST",
            message: `Insufficient rest (${gap}m < ${data.rule.minimumRestMinutes}m) between ${earlier.match.id} and ${later.match.id}.`,
            severity: restSeverity,
            matchIds: [earlier.match.id, later.match.id],
            entityIds: sharedEntries,
          });
        }

        if (
          earlier.courtId !== later.courtId &&
          gap < data.rule.courtChangeBufferMinutes
        ) {
          conflicts.push({
            code: "COURT_CHANGE_BUFFER",
            message: `Court-change buffer violated (${gap}m < ${data.rule.courtChangeBufferMinutes}m) between ${earlier.match.id} and ${later.match.id}.`,
            severity: restSeverity,
            matchIds: [earlier.match.id, later.match.id],
            entityIds: sharedEntries,
          });
        }
      }
    }
  }

  conflicts.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.matchIds.join().localeCompare(right.matchIds.join()),
  );

  return conflicts;
}
