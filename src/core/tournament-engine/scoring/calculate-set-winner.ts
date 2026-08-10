import { DomainError } from "@/core/tournament-engine/errors";
import { ScoringErrorCode } from "./errors";
import {
  getEffectiveSetPoints,
  isInProgressSetScore,
  isValidCompletedSetScore,
} from "./set-points";
import type { CalculateSetWinnerInput, EntryId } from "./types";

/**
 * Returns the winning entry id for a completed set, or null if the set is still in progress.
 * Throws DomainError when the score is illegal under the rule.
 */
export function calculateSetWinner(
  input: CalculateSetWinnerInput,
): EntryId | null {
  if (!input.entryIdA || !input.entryIdB || input.entryIdA === input.entryIdB) {
    throw new DomainError(
      ScoringErrorCode.INVALID_ENTRY_IDS,
      "entryIdA and entryIdB must be distinct non-empty ids.",
    );
  }

  const points = getEffectiveSetPoints(
    input.rule,
    input.isDecidingSet ?? false,
  );
  const { scoreA, scoreB } = input;

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    throw new DomainError(
      ScoringErrorCode.NON_INTEGER_SCORE,
      "Set scores must be integers.",
    );
  }

  if (scoreA < 0 || scoreB < 0) {
    throw new DomainError(
      ScoringErrorCode.NEGATIVE_SCORE,
      "Set scores cannot be negative.",
    );
  }

  if (isValidCompletedSetScore(scoreA, scoreB, points)) {
    return scoreA > scoreB ? input.entryIdA : input.entryIdB;
  }

  if (isInProgressSetScore(scoreA, scoreB, points)) {
    return null;
  }

  throw new DomainError(
    ScoringErrorCode.INVALID_SET_SCORE,
    "Set score is invalid under the match rule.",
  );
}
