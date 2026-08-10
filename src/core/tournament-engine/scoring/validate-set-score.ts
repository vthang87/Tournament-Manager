import { ScoringErrorCode } from "./errors";
import { getEffectiveSetPoints, isValidCompletedSetScore } from "./set-points";
import type { ValidateSetScoreInput, ValidationResult } from "./types";

/**
 * Validates a proposed completed set score against the rule snapshot.
 */
export function validateSetScore(
  input: ValidateSetScoreInput,
): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const { scoreA, scoreB, rule } = input;

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    errors.push({
      code: ScoringErrorCode.NON_INTEGER_SCORE,
      message: "Set scores must be integers.",
    });
    return { valid: false, errors };
  }

  if (scoreA < 0 || scoreB < 0) {
    errors.push({
      code: ScoringErrorCode.NEGATIVE_SCORE,
      message: "Set scores cannot be negative.",
    });
  }

  if (scoreA === scoreB) {
    errors.push({
      code: ScoringErrorCode.TIE_SCORE,
      message: "A completed set cannot be a tie.",
    });
  }

  const points = getEffectiveSetPoints(rule, input.isDecidingSet ?? false);

  if (scoreA > points.maxPoints || scoreB > points.maxPoints) {
    errors.push({
      code: ScoringErrorCode.EXCEEDS_MAX_POINTS,
      message: `Set scores cannot exceed maxPoints (${points.maxPoints}).`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  if (!isValidCompletedSetScore(scoreA, scoreB, points)) {
    errors.push({
      code: ScoringErrorCode.INVALID_SET_SCORE,
      message:
        "Set score is not a valid completed result under the match rule (deuce/winBy/maxPoints).",
    });
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}
