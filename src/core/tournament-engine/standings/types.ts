/** Standings engine domain types. */

export type StandingCriterion =
  | "MATCH_WINS"
  | "HEAD_TO_HEAD"
  | "SET_DIFFERENCE"
  | "POINT_DIFFERENCE"
  | "POINTS_WON"
  | "SETS_WON"
  | "MATCHES_PLAYED"
  | "ENTRY_ID"
  | "DRAW_REQUIRED";

export type StandingEntry = {
  id: string;
};

export type StandingMatchSet = {
  scoreA: number;
  scoreB: number;
};

export type StandingMatchResolution =
  | "NORMAL"
  | "WALKOVER"
  | "RETIREMENT"
  | "DISQUALIFICATION"
  | "NO_SHOW";

export type StandingMatch = {
  id: string;
  entryAId: string;
  entryBId: string;
  /** Null when match is not yet finished. */
  winnerEntryId: string | null;
  resolution?: StandingMatchResolution;
  sets: StandingMatchSet[];
};

/**
 * How special resolutions contribute to standings aggregates.
 * All awards are applied from the winner's perspective.
 */
export type SpecialResolutionPolicy = {
  /** Sets credited to winner / loser when there are no scored sets. */
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
};

export type StandingsSpecialPolicy = {
  walkover: SpecialResolutionPolicy;
  retirement: SpecialResolutionPolicy & {
    /** When true, include actual played set scores before applying awards for remaining. */
    includePlayedSets: boolean;
  };
  disqualification: SpecialResolutionPolicy;
  noShow: SpecialResolutionPolicy;
};

export type StandingRule = {
  criteria: StandingCriterion[];
  specialPolicy?: StandingsSpecialPolicy;
};

export type TieBreakStep = {
  criterion: StandingCriterion;
  /** Entries still tied when this step was applied. */
  groupEntryIds: string[];
  /** Value used for this entry at this step (stringified for trace). */
  value: string;
};

export type StandingRow = {
  entryId: string;
  rank: number;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  pointsWon: number;
  pointsLost: number;
  pointDifference: number;
  tieBreakTrace: TieBreakStep[];
  /** True when ranking could not be fully resolved (DRAW_REQUIRED). */
  drawRequired?: boolean;
};

export type CalculateStandingsInput = {
  entries: StandingEntry[];
  matches: StandingMatch[];
  rule: StandingRule;
};

export const DEFAULT_STANDING_CRITERIA: StandingCriterion[] = [
  "MATCH_WINS",
  "HEAD_TO_HEAD",
  "SET_DIFFERENCE",
  "POINT_DIFFERENCE",
  "POINTS_WON",
  "ENTRY_ID",
];

export const DEFAULT_SPECIAL_POLICY: StandingsSpecialPolicy = {
  walkover: {
    setsWon: 2,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
  },
  retirement: {
    setsWon: 2,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
    includePlayedSets: true,
  },
  disqualification: {
    setsWon: 2,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
  },
  noShow: {
    setsWon: 2,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
  },
};
