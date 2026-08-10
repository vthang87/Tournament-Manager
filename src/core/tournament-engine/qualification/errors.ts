/** Stable qualification domain error codes. */

export const QualificationErrorCode = {
  INVALID_INPUT: "QUALIFICATION_INVALID_INPUT",
  EMPTY_GROUPS: "QUALIFICATION_EMPTY_GROUPS",
  INSUFFICIENT_STANDINGS: "QUALIFICATION_INSUFFICIENT_STANDINGS",
  UNEVEN_GROUP_SIZES: "QUALIFICATION_UNEVEN_GROUP_SIZES",
  INVALID_RULE: "QUALIFICATION_INVALID_RULE",
} as const;

export type QualificationErrorCode =
  (typeof QualificationErrorCode)[keyof typeof QualificationErrorCode];
