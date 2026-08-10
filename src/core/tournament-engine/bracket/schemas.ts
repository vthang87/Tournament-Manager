import { z } from "zod";

export const bracketPlacementRuleSchema = z.enum([
  "BY_QUALIFICATION_SEED",
  "STANDARD_GROUP_CROSS",
]);

export const byeAssignmentSchema = z.enum(["TOP_SEEDS", "BOTTOM_SEEDS"]);

export const qualifierInputSchema = z.object({
  entryId: z.string().min(1),
  sourceGroupId: z.string().min(1),
  sourceRank: z.number().int().positive(),
  qualificationSeed: z.number().int().positive(),
  isAdditional: z.boolean(),
});

export const generateBracketInputSchema = z.object({
  qualifiers: z.array(qualifierInputSchema).min(1),
  bracketSize: z.number().int().positive(),
  placementRule: bracketPlacementRuleSchema,
  byeAssignment: byeAssignmentSchema.optional(),
  thirdPlaceEnabled: z.boolean().optional(),
  avoidSameGroupRoundOne: z.boolean().optional(),
});

export const completedBracketMatchSchema = z.object({
  matchId: z.string().min(1),
  winnerEntryId: z.string().min(1),
});
