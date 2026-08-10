import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import type { EffectiveSetPoints } from "@/core/tournament-engine/match-rules/types";

export function getEffectiveSetPoints(
  rule: MatchRuleSnapshot,
  isDecidingSet: boolean,
): EffectiveSetPoints {
  if (
    isDecidingSet &&
    rule.decidingSetPoints !== null &&
    rule.decidingSetWinBy !== null &&
    rule.decidingSetMaxPoints !== null
  ) {
    return {
      pointsToWin: rule.decidingSetPoints,
      winBy: rule.decidingSetWinBy,
      maxPoints: rule.decidingSetMaxPoints,
      deuceEnabled: rule.deuceEnabled,
    };
  }

  return {
    pointsToWin: rule.pointsToWin,
    winBy: rule.winBy,
    maxPoints: rule.maxPoints,
    deuceEnabled: rule.deuceEnabled,
  };
}

export function setsToWin(bestOfSets: number): number {
  return Math.ceil(bestOfSets / 2);
}

/**
 * Returns whether (scoreA, scoreB) is a legal completed set under the points policy.
 */
export function isValidCompletedSetScore(
  scoreA: number,
  scoreB: number,
  points: EffectiveSetPoints,
): boolean {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return false;
  }
  if (scoreA < 0 || scoreB < 0) {
    return false;
  }
  if (scoreA === scoreB) {
    return false;
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);
  const { pointsToWin, winBy, maxPoints, deuceEnabled } = points;

  if (winner > maxPoints || loser > maxPoints) {
    return false;
  }

  if (!deuceEnabled) {
    return winner === pointsToWin && loser < pointsToWin;
  }

  // Straight set: reached pointsToWin with required margin before deuce territory.
  if (winner === pointsToWin && loser <= pointsToWin - winBy) {
    return true;
  }

  // Deuce continuation: winner above pointsToWin.
  if (winner > pointsToWin) {
    // Opponent must have reached deuce range (pointsToWin - 1).
    if (loser < pointsToWin - 1) {
      return false;
    }

    if (winner === maxPoints) {
      // At cap, winner must be ahead and loser must not already have lost earlier.
      return loser >= maxPoints - winBy && loser < maxPoints;
    }

    return winner - loser === winBy;
  }

  return false;
}

/**
 * True when neither side has yet won the set, but scores are legal so far.
 */
export function isInProgressSetScore(
  scoreA: number,
  scoreB: number,
  points: EffectiveSetPoints,
): boolean {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return false;
  }
  if (scoreA < 0 || scoreB < 0) {
    return false;
  }
  if (isValidCompletedSetScore(scoreA, scoreB, points)) {
    return false;
  }

  const high = Math.max(scoreA, scoreB);
  const { pointsToWin, maxPoints, deuceEnabled } = points;

  if (high > maxPoints) {
    return false;
  }

  if (!deuceEnabled) {
    return high < pointsToWin;
  }

  // Cannot be past a completed state and still "in progress".
  // Allow scores while neither side has met a win condition.
  if (high < pointsToWin) {
    return true;
  }

  // Deuce territory: both at least pointsToWin-1 and not yet won.
  const low = Math.min(scoreA, scoreB);
  if (high >= pointsToWin && low >= pointsToWin - 1 && high < maxPoints) {
    const margin = high - low;
    return margin < points.winBy;
  }

  // One side reached pointsToWin without winBy (e.g. 21-20) — still in progress.
  if (high === pointsToWin && low > pointsToWin - points.winBy && low < high) {
    return true;
  }

  return false;
}
