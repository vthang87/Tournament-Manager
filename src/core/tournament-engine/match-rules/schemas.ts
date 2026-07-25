import { z } from "zod";
import { MatchRuleErrorCode } from "./errors";

function isOddPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value % 2 === 1;
}

function refineScoringFields(
  value: {
    bestOfSets: number;
    pointsToWin: number;
    winBy: number;
    maxPoints: number;
    deuceEnabled: boolean;
    decidingSetPoints: number | null;
    decidingSetWinBy: number | null;
    decidingSetMaxPoints: number | null;
    changeEndsEnabled: boolean;
    changeEndsAt: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (!isOddPositiveInteger(value.bestOfSets)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: MatchRuleErrorCode.INVALID_BEST_OF_SETS,
      path: ["bestOfSets"],
    });
  }

  if (!(value.pointsToWin > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: MatchRuleErrorCode.INVALID_POINTS_TO_WIN,
      path: ["pointsToWin"],
    });
  }

  if (!(value.winBy > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: MatchRuleErrorCode.INVALID_WIN_BY,
      path: ["winBy"],
    });
  }

  if (!(value.maxPoints >= value.pointsToWin)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: MatchRuleErrorCode.INVALID_MAX_POINTS,
      path: ["maxPoints"],
    });
  }

  const deciding = [
    value.decidingSetPoints,
    value.decidingSetWinBy,
    value.decidingSetMaxPoints,
  ];
  const nullCount = deciding.filter((field) => field === null).length;

  if (nullCount !== 0 && nullCount !== 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: MatchRuleErrorCode.INCONSISTENT_DECIDING_SET,
      path: ["decidingSetPoints"],
    });
  } else if (nullCount === 0) {
    const points = value.decidingSetPoints!;
    const winBy = value.decidingSetWinBy!;
    const maxPoints = value.decidingSetMaxPoints!;

    if (!(maxPoints >= points)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MatchRuleErrorCode.INVALID_MAX_POINTS,
        path: ["decidingSetMaxPoints"],
      });
    }

    if (!(winBy > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MatchRuleErrorCode.INVALID_WIN_BY,
        path: ["decidingSetWinBy"],
      });
    }
  }

  if (
    value.changeEndsEnabled &&
    value.changeEndsAt !== null &&
    !(value.changeEndsAt > 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: MatchRuleErrorCode.INVALID_CHANGE_ENDS_AT,
      path: ["changeEndsAt"],
    });
  }
}

const scoringFieldsBaseSchema = z.object({
  bestOfSets: z.number().int(),
  pointsToWin: z.number().int(),
  winBy: z.number().int(),
  maxPoints: z.number().int(),
  deuceEnabled: z.boolean(),
  decidingSetPoints: z.number().int().positive().nullable(),
  decidingSetWinBy: z.number().int().positive().nullable(),
  decidingSetMaxPoints: z.number().int().positive().nullable(),
  changeEndsEnabled: z.boolean(),
  changeEndsAt: z.number().int().positive().nullable(),
});

export const matchRuleSnapshotSchema = scoringFieldsBaseSchema
  .extend({
    name: z.string().min(1).optional(),
  })
  .superRefine(refineScoringFields);

export const matchRuleSchema = scoringFieldsBaseSchema
  .extend({
    id: z.string().min(1),
    eventId: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .superRefine(refineScoringFields);

export type MatchRuleSnapshotInput = z.input<typeof matchRuleSnapshotSchema>;
export type MatchRuleInput = z.input<typeof matchRuleSchema>;
