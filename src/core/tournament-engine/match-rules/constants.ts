/**
 * Well-known match-rule preset names (documented for seed/UI alignment).
 * Seed may use different display labels; engines/UI can map by these constants.
 */
export const MATCH_RULE_PRESET_NAMES = {
  BADMINTON_STANDARD_21: "Badminton Standard 21",
  FAST_GROUP_STAGE: "Fast Group Stage",
  FAST_KNOCKOUT: "Fast Knockout",
} as const;

export type MatchRulePresetName =
  (typeof MATCH_RULE_PRESET_NAMES)[keyof typeof MATCH_RULE_PRESET_NAMES];

/** Default scoring parameters matching common badminton presets. */
export const MATCH_RULE_PRESETS = {
  [MATCH_RULE_PRESET_NAMES.BADMINTON_STANDARD_21]: {
    bestOfSets: 3,
    pointsToWin: 21,
    winBy: 2,
    maxPoints: 30,
    deuceEnabled: true,
  },
  [MATCH_RULE_PRESET_NAMES.FAST_GROUP_STAGE]: {
    bestOfSets: 1,
    pointsToWin: 21,
    winBy: 2,
    maxPoints: 30,
    deuceEnabled: true,
  },
  [MATCH_RULE_PRESET_NAMES.FAST_KNOCKOUT]: {
    bestOfSets: 3,
    pointsToWin: 15,
    winBy: 2,
    maxPoints: 21,
    deuceEnabled: true,
  },
} as const;
