import { z } from "zod";

export const standingCriterionSchema = z.enum([
  "MATCH_WINS",
  "HEAD_TO_HEAD",
  "SET_DIFFERENCE",
  "POINT_DIFFERENCE",
  "POINTS_WON",
  "SETS_WON",
  "MATCHES_PLAYED",
  "ENTRY_ID",
  "DRAW_REQUIRED",
]);

const specialResolutionPolicySchema = z.object({
  setsWon: z.number().int().nonnegative(),
  setsLost: z.number().int().nonnegative(),
  pointsWon: z.number().int().nonnegative(),
  pointsLost: z.number().int().nonnegative(),
  includePlayedSets: z.boolean().optional(),
});

export const standingsSpecialPolicySchema = z.object({
  walkover: specialResolutionPolicySchema,
  retirement: specialResolutionPolicySchema.extend({
    includePlayedSets: z.boolean(),
  }),
  disqualification: specialResolutionPolicySchema,
  noShow: specialResolutionPolicySchema,
});

export const standingRuleSchema = z.object({
  criteria: z.array(standingCriterionSchema).min(1),
  specialPolicy: standingsSpecialPolicySchema.optional(),
});

export const standingEntrySchema = z.object({
  id: z.string().min(1),
});

export const standingMatchSetSchema = z.object({
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
});

export const standingMatchSchema = z.object({
  id: z.string().min(1),
  entryAId: z.string().min(1),
  entryBId: z.string().min(1),
  winnerEntryId: z.string().min(1).nullable(),
  resolution: z
    .enum([
      "NORMAL",
      "WALKOVER",
      "RETIREMENT",
      "DISQUALIFICATION",
      "NO_SHOW",
    ])
    .optional(),
  sets: z.array(standingMatchSetSchema),
});

export const calculateStandingsInputSchema = z.object({
  entries: z.array(standingEntrySchema).min(1),
  matches: z.array(standingMatchSchema),
  rule: standingRuleSchema,
});
