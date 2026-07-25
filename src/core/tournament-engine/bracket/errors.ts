/** Stable bracket domain error codes. */

export const BracketErrorCode = {
  INVALID_INPUT: "BRACKET_INVALID_INPUT",
  INVALID_SIZE: "BRACKET_INVALID_SIZE",
  TOO_MANY_QUALIFIERS: "BRACKET_TOO_MANY_QUALIFIERS",
  UNKNOWN_MATCH: "BRACKET_UNKNOWN_MATCH",
  MATCH_NOT_COMPLETED: "BRACKET_MATCH_NOT_COMPLETED",
  INVALID_WINNER: "BRACKET_INVALID_WINNER",
} as const;

export type BracketErrorCode =
  (typeof BracketErrorCode)[keyof typeof BracketErrorCode];
