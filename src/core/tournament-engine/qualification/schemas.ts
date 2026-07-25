import { z } from "zod";
import { standingCriterionSchema } from "@/core/tournament-engine/standings/schemas";

export const qualificationRuleSchema = z.object({
  topPerGroup: z.number().int().positive(),
  bestAdditionalEntries: z.number().int().nonnegative(),
  additionalFromRank: z.number().int().positive().optional(),
  rankingCriteria: z.array(standingCriterionSchema).min(1).optional(),
});

const standingRowSchema = z.object({
  entryId: z.string().min(1),
  rank: z.number().int().positive(),
  played: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  setsWon: z.number().int().nonnegative(),
  setsLost: z.number().int().nonnegative(),
  setDifference: z.number().int(),
  pointsWon: z.number().int().nonnegative(),
  pointsLost: z.number().int().nonnegative(),
  pointDifference: z.number().int(),
  tieBreakTrace: z.array(z.unknown()),
  drawRequired: z.boolean().optional(),
});

export const groupStandingsSchema = z.object({
  groupId: z.string().min(1),
  standings: z.array(standingRowSchema),
});

export const resolveQualificationInputSchema = z.object({
  standingsByGroup: z.array(groupStandingsSchema).min(1),
  rule: qualificationRuleSchema,
});
