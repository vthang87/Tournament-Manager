import { ScoringErrorCode } from "@/core/tournament-engine/scoring/errors";

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

/** Map scoring engine error codes to localized UI strings. */
export function localizeScoringError(
  t: TranslateFn,
  error: { code: string; message: string },
): string {
  switch (error.code) {
    case ScoringErrorCode.NON_INTEGER_SCORE:
      return t("scoringNonInteger");
    case ScoringErrorCode.NEGATIVE_SCORE:
      return t("scoringNegative");
    case ScoringErrorCode.TIE_SCORE:
      return t("scoringTie");
    case ScoringErrorCode.INVALID_SET_SCORE:
      return t("scoringInvalidSetScore");
    case ScoringErrorCode.EXCEEDS_MAX_POINTS: {
      const match = error.message.match(/\((\d+)\)/);
      return t("scoringExceedsMax", { max: match?.[1] ?? "?" });
    }
    case ScoringErrorCode.SET_NOT_COMPLETE: {
      const match = error.message.match(/Set (\d+)/);
      return t("scoringSetNotComplete", { setNumber: match?.[1] ?? "?" });
    }
    case ScoringErrorCode.EXTRA_SETS:
      return t("scoringExtraSets");
    case ScoringErrorCode.INVALID_SET_NUMBER:
      return t("scoringInvalidSetNumber");
    case ScoringErrorCode.INVALID_ENTRY_IDS:
      return t("scoringInvalidEntries");
    case ScoringErrorCode.INVALID_RULE:
      return t("scoringInvalidRule");
    case ScoringErrorCode.INVALID_INPUT:
      return t("scoringInvalidInput");
    default:
      return error.message;
  }
}
