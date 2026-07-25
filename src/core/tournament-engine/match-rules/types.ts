/** Match rule domain types (plain objects; no DB/ORM types). */

export type MatchRule = {
  id: string;
  eventId: string;
  name: string;
  bestOfSets: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  deuceEnabled: boolean;
  decidingSetPoints: number | null;
  decidingSetWinBy: number | null;
  decidingSetMaxPoints: number | null;
  changeEndsEnabled: boolean;
  changeEndsAt: number | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Immutable scoring parameters captured when a match is created.
 * Intentionally omits mutable database identity and timestamps.
 */
export type MatchRuleSnapshot = {
  bestOfSets: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  deuceEnabled: boolean;
  decidingSetPoints: number | null;
  decidingSetWinBy: number | null;
  decidingSetMaxPoints: number | null;
  changeEndsEnabled: boolean;
  changeEndsAt: number | null;
  /** Display name copied at snapshot time (optional). */
  name?: string;
};

export type ResolveMatchRuleInput = {
  /** Explicit match override or already-persisted snapshot (highest priority). */
  matchOverride?: MatchRuleSnapshot | MatchRule | null;
  /** Stage-assigned rule. */
  stageRule?: MatchRule | MatchRuleSnapshot | null;
  /** Event default rule (lowest priority). */
  eventDefaultRule?: MatchRule | MatchRuleSnapshot | null;
};

export type EffectiveSetPoints = {
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  deuceEnabled: boolean;
};
