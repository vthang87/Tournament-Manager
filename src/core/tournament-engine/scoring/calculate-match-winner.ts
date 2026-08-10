import { DomainError } from "@/core/tournament-engine/errors";
import { createMatchRuleSnapshot } from "@/core/tournament-engine/match-rules/create-snapshot";
import { ScoringErrorCode } from "./errors";
import { calculateSetWinner } from "./calculate-set-winner";
import { setsToWin as computeSetsToWin } from "./set-points";
import type {
  CalculateMatchWinnerInput,
  MatchOutcome,
  SetOutcome,
} from "./types";

/**
 * Calculates match outcome from ordered set scores.
 * Deciding set uses separate points when configured.
 * Rejects extra sets after a match winner is already determined.
 */
export function calculateMatchWinner(
  input: CalculateMatchWinnerInput,
): MatchOutcome {
  if (!input.entryIdA || !input.entryIdB || input.entryIdA === input.entryIdB) {
    throw new DomainError(
      ScoringErrorCode.INVALID_ENTRY_IDS,
      "entryIdA and entryIdB must be distinct non-empty ids.",
    );
  }

  // Normalize / validate rule (throws DomainError on invalid).
  const rule = createMatchRuleSnapshot(input.rule);
  const setsToWin = computeSetsToWin(rule.bestOfSets);

  const sorted = [...input.sets].sort((a, b) => a.setNumber - b.setNumber);

  for (let index = 0; index < sorted.length; index += 1) {
    const set = sorted[index]!;
    if (set.setNumber !== index + 1) {
      throw new DomainError(
        ScoringErrorCode.INVALID_SET_NUMBER,
        `Set numbers must be contiguous starting at 1; expected ${index + 1}, got ${set.setNumber}.`,
      );
    }
  }

  let setsWonA = 0;
  let setsWonB = 0;
  let matchWinner: string | null = null;
  const outcomes: SetOutcome[] = [];

  for (const set of sorted) {
    if (matchWinner !== null) {
      throw new DomainError(
        ScoringErrorCode.EXTRA_SETS,
        "Cannot include additional sets after a match winner has already been determined.",
      );
    }

    if (set.setNumber > rule.bestOfSets) {
      throw new DomainError(
        ScoringErrorCode.EXTRA_SETS,
        `Cannot play more than bestOfSets (${rule.bestOfSets}) sets.`,
      );
    }

    const isDecidingSet =
      setsWonA === setsToWin - 1 && setsWonB === setsToWin - 1;

    const winnerEntryId = calculateSetWinner({
      scoreA: set.scoreA,
      scoreB: set.scoreB,
      rule,
      entryIdA: input.entryIdA,
      entryIdB: input.entryIdB,
      isDecidingSet,
    });

    if (winnerEntryId === null) {
      throw new DomainError(
        ScoringErrorCode.SET_NOT_COMPLETE,
        `Set ${set.setNumber} is not a completed set score.`,
      );
    }

    if (winnerEntryId === input.entryIdA) {
      setsWonA += 1;
    } else {
      setsWonB += 1;
    }

    outcomes.push({
      setNumber: set.setNumber,
      scoreA: set.scoreA,
      scoreB: set.scoreB,
      winnerEntryId,
    });

    if (setsWonA >= setsToWin) {
      matchWinner = input.entryIdA;
    } else if (setsWonB >= setsToWin) {
      matchWinner = input.entryIdB;
    }
  }

  return {
    winnerEntryId: matchWinner,
    setsWonA,
    setsWonB,
    isComplete: matchWinner !== null,
    setsToWin,
    sets: outcomes,
  };
}
