import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";

export type EntryId = string;

export type SetScore = {
  setNumber: number;
  scoreA: number;
  scoreB: number;
};

export type SetOutcome = {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  winnerEntryId: EntryId | null;
};

export type MatchOutcome = {
  winnerEntryId: EntryId | null;
  setsWonA: number;
  setsWonB: number;
  isComplete: boolean;
  setsToWin: number;
  sets: SetOutcome[];
};

export type ValidationIssue = {
  code: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
};

export type ValidateSetScoreInput = {
  scoreA: number;
  scoreB: number;
  rule: MatchRuleSnapshot;
  /** When true, use deciding-set point fields when present. */
  isDecidingSet?: boolean;
};

export type CalculateSetWinnerInput = {
  scoreA: number;
  scoreB: number;
  rule: MatchRuleSnapshot;
  entryIdA: EntryId;
  entryIdB: EntryId;
  isDecidingSet?: boolean;
};

export type CalculateMatchWinnerInput = {
  sets: SetScore[];
  rule: MatchRuleSnapshot;
  entryIdA: EntryId;
  entryIdB: EntryId;
};
