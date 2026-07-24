import { z } from "zod";

export const seedDistributionSchema = z.enum(["NORMAL", "SERPENTINE"]);

export const drawEntrySchema = z.object({
  id: z.string().min(1),
  seed: z.number().int().positive().nullable().optional(),
  clubId: z.string().min(1).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
  regionId: z.string().min(1).nullable().optional(),
});

export const drawGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive(),
});

export const drawConfigurationSchema = z.object({
  seedDistribution: seedDistributionSchema,
  avoidSameClub: z.boolean(),
  avoidSameTeam: z.boolean().optional(),
  avoidSameRegion: z.boolean().optional(),
});

export const generateDrawInputSchema = z.object({
  entries: z.array(drawEntrySchema).min(1),
  groups: z.array(drawGroupSchema).min(1),
  configuration: drawConfigurationSchema,
  randomSeed: z.union([z.number().int(), z.string().min(1)]),
});

export const manualDrawAllocationSchema = z.object({
  groupId: z.string().min(1),
  entryId: z.string().min(1),
  position: z.number().int().nonnegative().optional(),
});

export const validateManualDrawInputSchema = z.object({
  allocation: z.array(manualDrawAllocationSchema),
  entries: z.array(drawEntrySchema).min(1),
  groups: z.array(drawGroupSchema).min(1),
  configuration: drawConfigurationSchema,
});
