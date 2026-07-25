/** Stable standings domain error codes. */

export const StandingsErrorCode = {
  INVALID_INPUT: "STANDINGS_INVALID_INPUT",
  DUPLICATE_ENTRY: "STANDINGS_DUPLICATE_ENTRY",
  UNKNOWN_ENTRY: "STANDINGS_UNKNOWN_ENTRY",
  INVALID_MATCH: "STANDINGS_INVALID_MATCH",
  DRAW_REQUIRED: "STANDINGS_DRAW_REQUIRED",
} as const;

export type StandingsErrorCode =
  (typeof StandingsErrorCode)[keyof typeof StandingsErrorCode];
