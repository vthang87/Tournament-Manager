/** Maps standing criterion codes to `standings.*` message keys. */
export const STANDING_CRITERION_MESSAGE_KEYS: Record<string, string> = {
  MATCH_WINS: "matchWins",
  HEAD_TO_HEAD: "headToHead",
  SET_DIFFERENCE: "setDifference",
  POINT_DIFFERENCE: "pointDifference",
  POINTS_WON: "pointsWon",
  SETS_WON: "setsWon",
  MATCHES_PLAYED: "matchesPlayed",
  ENTRY_ID: "entryIdFallback",
  DRAW_REQUIRED: "drawRequired",
};

type Translate = (key: string) => string;

export function localizeStandingCriterion(
  criterion: string,
  t: Translate,
): string {
  const key = STANDING_CRITERION_MESSAGE_KEYS[criterion];
  return key ? t(key) : criterion;
}

export function formatStandingCriteria(
  criteria: string[],
  t: Translate,
): string {
  return criteria.map((c) => localizeStandingCriterion(c, t)).join(" → ");
}
