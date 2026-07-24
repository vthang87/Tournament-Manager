/** Stable round-robin domain error codes. */

export const RoundRobinErrorCode = {
  INVALID_INPUT: "ROUND_ROBIN_INVALID_INPUT",
  TOO_FEW_ENTRIES: "ROUND_ROBIN_TOO_FEW_ENTRIES",
  DUPLICATE_ENTRY: "ROUND_ROBIN_DUPLICATE_ENTRY",
} as const;

export type RoundRobinErrorCode =
  (typeof RoundRobinErrorCode)[keyof typeof RoundRobinErrorCode];
