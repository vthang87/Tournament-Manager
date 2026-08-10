import { z } from "zod";

export const scheduleCourtSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  active: z.boolean(),
});

export const scheduleMatchSchema = z.object({
  id: z.string().min(1),
  entryAId: z.string().min(1).nullable(),
  entryBId: z.string().min(1).nullable(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
});

export const scheduleAssignmentSchema = z.object({
  matchId: z.string().min(1),
  courtId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1).optional(),
});

export const scheduleRuleSchema = z.object({
  defaultMatchDurationMinutes: z.number().int().positive(),
  minimumRestMinutes: z.number().int().nonnegative(),
  courtChangeBufferMinutes: z.number().int().nonnegative(),
  hardRestConflicts: z.boolean().optional(),
});

export const courtAvailabilityWindowSchema = z.object({
  courtId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

export const validateScheduleInputSchema = z.object({
  matches: z.array(scheduleMatchSchema),
  assignments: z.array(scheduleAssignmentSchema),
  courts: z.array(scheduleCourtSchema).min(1),
  rule: scheduleRuleSchema,
  entryPlayerIds: z.record(z.array(z.string().min(1))).optional(),
  availability: z.array(courtAvailabilityWindowSchema).optional(),
});
