/** Scheduling engine domain types. */

export type ScheduleConflictSeverity = "error" | "warning";

export type ScheduleConflictCode =
  | "COURT_OVERLAP"
  | "ENTRY_OVERLAP"
  | "PLAYER_OVERLAP"
  | "INSUFFICIENT_REST"
  | "COURT_CHANGE_BUFFER"
  | "INACTIVE_COURT"
  | "OUTSIDE_AVAILABILITY";

export type ScheduleConflict = {
  code: ScheduleConflictCode;
  message: string;
  severity: ScheduleConflictSeverity;
  matchIds: string[];
  entityIds?: string[];
};

export type ScheduleCourt = {
  id: string;
  name?: string;
  active: boolean;
};

export type ScheduleMatch = {
  id: string;
  entryAId: string | null;
  entryBId: string | null;
  /** Optional override duration in minutes. */
  estimatedDurationMinutes?: number | null;
};

export type ScheduleAssignment = {
  matchId: string;
  courtId: string;
  /** ISO-8601 UTC start. */
  startTime: string;
  /** ISO-8601 UTC end; if omitted, derived from rule duration. */
  endTime?: string;
};

export type ScheduleRule = {
  defaultMatchDurationMinutes: number;
  minimumRestMinutes: number;
  courtChangeBufferMinutes: number;
  /** When true, rest/buffer violations are errors; otherwise warnings. */
  hardRestConflicts?: boolean;
};

export type CourtAvailabilityWindow = {
  courtId: string;
  /** ISO-8601 UTC. */
  startTime: string;
  endTime: string;
};

export type ValidateScheduleInput = {
  matches: ScheduleMatch[];
  assignments: ScheduleAssignment[];
  courts: ScheduleCourt[];
  rule: ScheduleRule;
  /**
   * Maps entryId → playerIds for cross-entry player conflict detection.
   */
  entryPlayerIds?: Record<string, string[]>;
  /** Optional declared court availability windows. */
  availability?: CourtAvailabilityWindow[];
};

export type TimeInterval = {
  startMs: number;
  endMs: number;
};
