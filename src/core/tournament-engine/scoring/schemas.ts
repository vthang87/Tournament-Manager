import { z } from "zod";
import { matchRuleSnapshotSchema } from "@/core/tournament-engine/match-rules/schemas";

export const setScoreSchema = z.object({
  setNumber: z.number().int().positive(),
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
});

export const validateSetScoreInputSchema = z.object({
  scoreA: z.number(),
  scoreB: z.number(),
  rule: matchRuleSnapshotSchema,
  isDecidingSet: z.boolean().optional(),
});

export const calculateSetWinnerInputSchema = z.object({
  scoreA: z.number(),
  scoreB: z.number(),
  rule: matchRuleSnapshotSchema,
  entryIdA: z.string().min(1),
  entryIdB: z.string().min(1),
  isDecidingSet: z.boolean().optional(),
});

export const calculateMatchWinnerInputSchema = z.object({
  sets: z.array(setScoreSchema),
  rule: matchRuleSnapshotSchema,
  entryIdA: z.string().min(1),
  entryIdB: z.string().min(1),
});
