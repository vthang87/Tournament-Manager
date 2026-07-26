import { z } from "zod";
import { ValidationError } from "@/application/errors";

export const tournamentStatusSchema = z.enum([
  "DRAFT",
  "REGISTRATION",
  "DRAW",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
]);

export const eventTypeSchema = z.enum(["SINGLES", "DOUBLES", "TEAM"]);
export const genderCategorySchema = z.enum(["MALE", "FEMALE", "MIXED", "OPEN"]);
export const eventStatusSchema = z.enum([
  "SETUP",
  "DRAW_READY",
  "DRAW_CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
]);
export const stageFormatSchema = z.enum(["GROUP", "KNOCKOUT"]);
export const stageStatusSchema = z.enum(["PENDING", "ACTIVE", "COMPLETED"]);
export const entryStatusSchema = z.enum([
  "ACTIVE",
  "WITHDRAWN",
  "DISQUALIFIED",
]);
export const playerGenderSchema = z.enum([
  "MALE",
  "FEMALE",
  "OTHER",
  "UNSPECIFIED",
]);
export const userRoleSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATOR",
  "SCOREKEEPER",
  "VIEWER",
]);

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(
    /^[a-z0-9._-]+$/,
    "Username may only contain lowercase letters, numbers, dots, hyphens and underscores",
  );

export const createManagedUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
  role: userRoleSchema,
  active: z.boolean().optional(),
});

export const updateManagedUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(120),
  role: userRoleSchema,
  active: z.boolean(),
});

export const resetManagedUserPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional();

export const createTournamentSchema = z.object({
  sportId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
  description: optionalTrimmed,
  location: optionalTrimmed,
  timezone: z.string().trim().min(1).max(80),
  startDate: optionalTrimmed,
  endDate: optionalTrimmed,
});

export const updateTournamentSchema = createTournamentSchema.partial();

export const createEventSchema = z.object({
  tournamentId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  type: eventTypeSchema,
  genderCategory: genderCategorySchema,
  defaultMatchRuleId: z.string().min(1).nullable().optional(),
  thirdPlaceMatchEnabled: z.boolean().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: eventTypeSchema.optional(),
  genderCategory: genderCategorySchema.optional(),
  defaultMatchRuleId: z.string().min(1).nullable().optional(),
  thirdPlaceMatchEnabled: z.boolean().optional(),
});

export const createCourtSchema = z.object({
  tournamentId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40),
  active: z.boolean().optional(),
});

export const updateCourtSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});

export const createStageSchema = z.object({
  eventId: z.string().min(1),
  type: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  orderIndex: z.number().int().min(0),
  format: stageFormatSchema,
  matchRuleId: z.string().min(1).nullable().optional(),
});

export const updateStageSchema = z.object({
  type: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  format: stageFormatSchema.optional(),
  matchRuleId: z.string().min(1).nullable().optional(),
});

export const reorderStagesSchema = z.object({
  eventId: z.string().min(1),
  orderedStageIds: z.array(z.string().min(1)).min(1),
});

export const createMatchRuleSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  bestOfSets: z.number().int().positive(),
  pointsToWin: z.number().int().positive(),
  winBy: z.number().int().positive(),
  maxPoints: z.number().int().positive(),
  deuceEnabled: z.boolean().optional(),
  decidingSetPoints: z.number().int().positive().nullable().optional(),
  decidingSetWinBy: z.number().int().positive().nullable().optional(),
  decidingSetMaxPoints: z.number().int().positive().nullable().optional(),
  changeEndsEnabled: z.boolean().optional(),
  changeEndsAt: z.number().int().positive().nullable().optional(),
});

export const updateMatchRuleSchema = createMatchRuleSchema
  .omit({ eventId: true })
  .partial();

export const createClubSchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortName: optionalTrimmed,
  logoUrl: optionalTrimmed,
});

export const updateClubSchema = createClubSchema.partial();

export const createPlayerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200),
  gender: playerGenderSchema.optional(),
  dateOfBirth: optionalTrimmed,
  phone: optionalTrimmed,
  email: z
    .union([z.string().trim().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  sports: z
    .array(
      z.object({
        sportId: z.string().min(1),
        clubId: z.string().min(1).nullable().optional(),
        ranking: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(1)
    .superRefine((profiles, ctx) => {
      const seen = new Set<string>();
      profiles.forEach((profile, index) => {
        if (seen.has(profile.sportId)) {
          ctx.addIssue({
            code: "custom",
            message: "Each sport may only appear once",
            path: [index, "sportId"],
          });
        }
        seen.add(profile.sportId);
      });
    }),
});

export const updatePlayerSchema = createPlayerSchema.partial();

export const entryMemberSchema = z.object({
  playerId: z.string().min(1),
  position: z.number().int().min(1),
});

export const createEntrySchema = z.object({
  eventId: z.string().min(1),
  displayName: z.string().trim().min(1).max(200),
  seed: z.number().int().positive().nullable().optional(),
  ranking: z.number().int().positive().nullable().optional(),
  clubId: z.string().min(1).nullable().optional(),
  members: z.array(entryMemberSchema).min(1),
});

export const updateEntrySchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  seed: z.number().int().positive().nullable().optional(),
  ranking: z.number().int().positive().nullable().optional(),
  clubId: z.string().min(1).nullable().optional(),
  members: z.array(entryMemberSchema).min(1).optional(),
});

export const drawSessionStatusSchema = z.enum(["DRAFT", "CONFIRMED", "LOCKED"]);
export const matchStatusSchema = z.enum([
  "PENDING",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "WALKOVER",
  "CANCELLED",
]);
export const matchResolutionSchema = z.enum([
  "NORMAL",
  "WALKOVER",
  "RETIREMENT",
  "DISQUALIFICATION",
  "NO_SHOW",
]);

export const drawConfigurationInputSchema = z.object({
  seedDistribution: z.enum(["NORMAL", "SERPENTINE"]),
  avoidSameClub: z.boolean(),
  avoidSameTeam: z.boolean().optional(),
  avoidSameRegion: z.boolean().optional(),
  groupCount: z.number().int().positive(),
  capacityPerGroup: z.number().int().positive(),
});

export const generateDrawSchema = z.object({
  eventId: z.string().min(1),
  stageId: z.string().min(1),
  configuration: drawConfigurationInputSchema,
  randomSeed: z.union([z.string().min(1), z.number()]),
});

export const manualDrawAllocationSchema = z.object({
  groupId: z.string().min(1),
  entryId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

export const validateManualDrawSchema = z.object({
  drawSessionId: z.string().min(1),
  allocation: z.array(manualDrawAllocationSchema).min(1),
});

export const saveManualDrawSchema = validateManualDrawSchema;

export const confirmDrawSchema = z.object({
  drawSessionId: z.string().min(1),
});

export const generateMatchesSchema = z.object({
  eventId: z.string().min(1),
  stageId: z.string().min(1),
});

export const resetMatchesSchema = z.object({
  eventId: z.string().min(1),
  stageId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
});

export const matchSetScoreSchema = z.object({
  setNumber: z.number().int().positive(),
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
});

export const enterScoreSchema = z.object({
  matchId: z.string().min(1),
  sets: z.array(matchSetScoreSchema).min(1),
  expectedUpdatedAt: z.string().min(1).optional(),
  /** Client-sent winner is ignored; server calculates via scoring engine. */
  winnerEntryId: z.string().min(1).optional(),
});

export const specialResolutionSchema = z.object({
  matchId: z.string().min(1),
  resolution: z.enum([
    "WALKOVER",
    "RETIREMENT",
    "DISQUALIFICATION",
    "NO_SHOW",
  ]),
  winnerEntryId: z.string().min(1),
  sets: z.array(matchSetScoreSchema).optional(),
  expectedUpdatedAt: z.string().min(1).optional(),
});

export const correctScoreSchema = z.object({
  matchId: z.string().min(1),
  sets: z.array(matchSetScoreSchema).min(1),
  reason: z.string().trim().min(1).max(500),
  expectedUpdatedAt: z.string().min(1).optional(),
});

export const cancelMatchSchema = z.object({
  matchId: z.string().min(1),
  reason: z.string().trim().min(1).max(500).optional(),
  expectedUpdatedAt: z.string().min(1).optional(),
});

export const createStandingRuleSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  criteria: z.array(z.string().min(1)).min(1),
  specialPolicy: z.unknown().optional(),
});

export const createQualificationRuleSchema = z.object({
  sourceStageId: z.string().min(1),
  targetStageId: z.string().min(1),
  topPerGroup: z.number().int().positive(),
  bestAdditionalEntries: z.number().int().min(0).optional(),
  additionalFromRank: z.number().int().positive().nullable().optional(),
  rankingCriteria: z.array(z.string().min(1)).optional(),
});

export const generateBracketSchema = z.object({
  sourceStageId: z.string().min(1),
  targetStageId: z.string().min(1),
  bracketSize: z.number().int().positive(),
  placementRule: z
    .enum(["BY_QUALIFICATION_SEED", "STANDARD_GROUP_CROSS"])
    .optional(),
  byeAssignment: z.enum(["TOP_SEEDS", "BOTTOM_SEEDS"]).optional(),
  avoidSameGroupRoundOne: z.boolean().optional(),
  thirdPlaceEnabled: z.boolean().optional(),
});

export const adminResetBracketSchema = z.object({
  stageId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
});

export const createScheduleRuleSchema = z.object({
  eventId: z.string().min(1),
  stageId: z.string().min(1).nullable().optional(),
  defaultMatchDurationMinutes: z.number().int().positive().optional(),
  minimumRestMinutes: z.number().int().min(0).optional(),
  courtChangeBufferMinutes: z.number().int().min(0).optional(),
  hardRestConflicts: z.boolean().optional(),
});

export const updateScheduleRuleSchema = z.object({
  defaultMatchDurationMinutes: z.number().int().positive().optional(),
  minimumRestMinutes: z.number().int().min(0).optional(),
  courtChangeBufferMinutes: z.number().int().min(0).optional(),
  hardRestConflicts: z.boolean().optional(),
});

export const scheduleAssignmentInputSchema = z.object({
  matchId: z.string().min(1),
  courtId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1).optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
});

export const saveAssignmentsSchema = z.object({
  eventId: z.string().min(1),
  assignments: z.array(scheduleAssignmentInputSchema).min(1),
});

export const bulkAssignSchema = z.object({
  eventId: z.string().min(1),
  matchIds: z.array(z.string().min(1)).min(1),
  courtIds: z.array(z.string().min(1)).min(1),
  startTime: z.string().min(1),
  gapMinutes: z.number().int().min(0).optional(),
});

export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
  code = "VALIDATION",
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    // Lazy import avoided cyclic issues — ValidationError is a simple class.
    throw new ValidationError(message, code);
  }
  return result.data;
}
