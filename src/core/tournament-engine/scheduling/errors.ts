/** Stable scheduling domain error codes. */

export const SchedulingErrorCode = {
  INVALID_INPUT: "SCHEDULING_INVALID_INPUT",
  UNKNOWN_MATCH: "SCHEDULING_UNKNOWN_MATCH",
  UNKNOWN_COURT: "SCHEDULING_UNKNOWN_COURT",
} as const;

export type SchedulingErrorCode =
  (typeof SchedulingErrorCode)[keyof typeof SchedulingErrorCode];
