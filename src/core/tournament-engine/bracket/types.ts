import type { Qualifier } from "@/core/tournament-engine/qualification/types";
import type { EngineWarning } from "@/core/tournament-engine/types";

/** Bracket engine domain types. */

export type BracketPlacementRule =
  | "BY_QUALIFICATION_SEED"
  | "STANDARD_GROUP_CROSS";

export type ByeAssignment = "TOP_SEEDS" | "BOTTOM_SEEDS";

export type BracketSlotSide = "A" | "B";

export type BracketMatchSlot = {
  entryId: string | null;
  /** True when this slot is a BYE (auto-advance opponent). */
  isBye: boolean;
  sourceGroupId?: string;
  sourceRank?: number;
  qualificationSeed?: number;
};

export type BracketMatch = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  slotA: BracketMatchSlot;
  slotB: BracketMatchSlot;
  winnerEntryId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: BracketSlotSide | null;
  /** For SF losers → third-place match. */
  loserNextMatchId: string | null;
  loserNextMatchSlot: BracketSlotSide | null;
  isThirdPlace: boolean;
};

export type Bracket = {
  bracketSize: number;
  roundCount: number;
  matches: BracketMatch[];
  thirdPlaceEnabled: boolean;
};

export type GenerateBracketInput = {
  qualifiers: Qualifier[];
  bracketSize: number;
  placementRule: BracketPlacementRule;
  byeAssignment?: ByeAssignment;
  thirdPlaceEnabled?: boolean;
  avoidSameGroupRoundOne?: boolean;
};

export type CompletedBracketMatch = {
  matchId: string;
  winnerEntryId: string;
};

export type AdvanceWinnerInput = {
  bracket: Bracket;
  completedMatch: CompletedBracketMatch;
};

export type BracketUpdate = {
  bracket: Bracket;
  warnings: EngineWarning[];
};
