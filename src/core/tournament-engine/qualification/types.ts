import type { StandingCriterion, StandingRow } from "@/core/tournament-engine/standings/types";

/** Qualification engine domain types. */

export type QualificationRule = {
  /** Number of top finishers taken from every group. */
  topPerGroup: number;
  /**
   * Number of best additional entries taken from a subsequent rank
   * (typically best thirds → additionalFromRank = topPerGroup + 1).
   */
  bestAdditionalEntries: number;
  /**
   * Group rank (1-based) used for best-additional selection.
   * Defaults to topPerGroup + 1 (e.g. 3 when topPerGroup is 2).
   */
  additionalFromRank?: number;
  /**
   * Ranking criteria used when comparing additional candidates across groups.
   * Defaults to the same set as standings defaults excluding HEAD_TO_HEAD.
   */
  rankingCriteria?: StandingCriterion[];
};

export type GroupStandings = {
  groupId: string;
  standings: StandingRow[];
};

export type Qualifier = {
  entryId: string;
  sourceGroupId: string;
  /** 1-based rank within the source group. */
  sourceRank: number;
  /** Overall seeding order among qualifiers (1 = highest). */
  qualificationSeed: number;
  /** True when taken via best-additional (e.g. best third). */
  isAdditional: boolean;
};

export type QualificationResult = {
  qualifiers: Qualifier[];
};

export type ResolveQualificationInput = {
  standingsByGroup: GroupStandings[];
  rule: QualificationRule;
};
