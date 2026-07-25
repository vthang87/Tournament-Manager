/** Shared domain types for V1 tournament management. */

export type UserRole = "ADMIN" | "OPERATOR" | "SCOREKEEPER" | "VIEWER";

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION"
  | "DRAW"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type EventType = "SINGLES" | "DOUBLES" | "TEAM";

export type GenderCategory = "MALE" | "FEMALE" | "MIXED" | "OPEN";

export type EventStatus =
  | "SETUP"
  | "DRAW_READY"
  | "DRAW_CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED";

export type StageFormat = "GROUP" | "KNOCKOUT";

export type StageStatus = "PENDING" | "ACTIVE" | "COMPLETED";

export type EntryStatus = "ACTIVE" | "WITHDRAWN" | "DISQUALIFIED";

export type PlayerGender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";

export type Tournament = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
};

export type TournamentEvent = {
  id: string;
  tournamentId: string;
  name: string;
  type: EventType;
  genderCategory: GenderCategory;
  status: EventStatus;
  defaultMatchRuleId: string | null;
  thirdPlaceMatchEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Court = {
  id: string;
  tournamentId: string;
  name: string;
  code: string;
  active: boolean;
  /** Whether a referee PIN is configured (hash never exposed). */
  hasAccessPin: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Stage = {
  id: string;
  eventId: string;
  type: string;
  name: string;
  orderIndex: number;
  format: StageFormat;
  status: StageStatus;
  createdAt: string;
  updatedAt: string;
};

export type StageRule = {
  stageId: string;
  matchRuleId: string;
};

export type MatchRuleRecord = {
  id: string;
  eventId: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
};

export type Club = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Player = {
  id: string;
  name: string;
  displayName: string;
  gender: PlayerGender;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  clubId: string | null;
  ranking: number | null;
  metadataJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Entry = {
  id: string;
  eventId: string;
  displayName: string;
  seed: number | null;
  ranking: number | null;
  clubId: string | null;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
};

export type EntryMember = {
  entryId: string;
  playerId: string;
  position: number;
};

export type EntryWithMembers = Entry & {
  members: EntryMember[];
};

export type DrawSessionStatus = "DRAFT" | "CONFIRMED" | "LOCKED";

export type DrawSession = {
  id: string;
  eventId: string;
  stageId: string;
  randomSeed: string;
  configurationSnapshotJson: string;
  status: DrawSessionStatus;
  createdBy: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type DrawResultRow = {
  drawSessionId: string;
  groupId: string;
  entryId: string;
  position: number;
};

export type CreateTournamentInput = {
  name: string;
  slug: string;
  description?: string | null;
  location?: string | null;
  timezone: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: TournamentStatus;
};

export type UpdateTournamentInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  location?: string | null;
  timezone?: string;
  startDate?: string | null;
  endDate?: string | null;
};

export type CreateTournamentEventInput = {
  tournamentId: string;
  name: string;
  type: EventType;
  genderCategory: GenderCategory;
  status?: EventStatus;
  defaultMatchRuleId?: string | null;
  thirdPlaceMatchEnabled?: boolean;
};

export type UpdateTournamentEventInput = {
  name?: string;
  type?: EventType;
  genderCategory?: GenderCategory;
  defaultMatchRuleId?: string | null;
  thirdPlaceMatchEnabled?: boolean;
};

export type CreateCourtInput = {
  tournamentId: string;
  name: string;
  code: string;
  active?: boolean;
};

export type UpdateCourtInput = {
  name?: string;
  code?: string;
  active?: boolean;
};

export type CreateStageInput = {
  eventId: string;
  type: string;
  name: string;
  orderIndex: number;
  format: StageFormat;
  matchRuleId?: string | null;
};

export type UpdateStageInput = {
  type?: string;
  name?: string;
  format?: StageFormat;
  matchRuleId?: string | null;
};

export type CreateMatchRuleInput = {
  eventId: string;
  name: string;
  bestOfSets: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  deuceEnabled?: boolean;
  decidingSetPoints?: number | null;
  decidingSetWinBy?: number | null;
  decidingSetMaxPoints?: number | null;
  changeEndsEnabled?: boolean;
  changeEndsAt?: number | null;
};

export type UpdateMatchRuleInput = Partial<
  Omit<CreateMatchRuleInput, "eventId">
>;

export type CreateClubInput = {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
};

export type UpdateClubInput = {
  name?: string;
  shortName?: string | null;
  logoUrl?: string | null;
};

export type CreatePlayerInput = {
  name: string;
  displayName: string;
  gender?: PlayerGender;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  clubId?: string | null;
  ranking?: number | null;
  metadataJson?: string | null;
};

export type UpdatePlayerInput = Partial<CreatePlayerInput>;

export type EntryMemberInput = {
  playerId: string;
  position: number;
};

export type CreateEntryInput = {
  eventId: string;
  displayName: string;
  seed?: number | null;
  ranking?: number | null;
  clubId?: string | null;
  members: EntryMemberInput[];
};

export type UpdateEntryInput = {
  displayName?: string;
  seed?: number | null;
  ranking?: number | null;
  clubId?: string | null;
  members?: EntryMemberInput[];
};

export type ActorContext = {
  /** Null for court-PIN kiosk sessions (audit allows null user). */
  userId: string | null;
  role: UserRole;
  /** Optional audit metadata (e.g. court PIN kiosk `{ via, courtId }`). */
  auditMetadata?: Record<string, unknown>;
};

export type MatchStatus =
  | "PENDING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "WALKOVER"
  | "CANCELLED";

export type MatchResolution =
  | "NORMAL"
  | "WALKOVER"
  | "RETIREMENT"
  | "DISQUALIFICATION"
  | "NO_SHOW";

export type MatchSlotSide = "A" | "B";

export type MatchSet = {
  id: string;
  matchId: string;
  setNumber: number;
  scoreA: number;
  scoreB: number;
  winnerEntryId: string | null;
};

export type MatchRecord = {
  id: string;
  eventId: string;
  stageId: string;
  groupId: string | null;
  roundNumber: number;
  bracketPosition: number | null;
  entryAId: string | null;
  entryBId: string | null;
  winnerEntryId: string | null;
  status: MatchStatus;
  resolution: MatchResolution | null;
  ruleSnapshotJson: string;
  generationKey: string | null;
  courtId: string | null;
  scheduledAt: string | null;
  estimatedDurationMinutes: number | null;
  /** Countdown target while teams are called to court (pre-start); null when not called. */
  warmupUntil: string | null;
  startedAt: string | null;
  completedAt: string | null;
  nextMatchId: string | null;
  nextMatchSlot: MatchSlotSide | null;
  loserNextMatchId: string | null;
  loserNextMatchSlot: MatchSlotSide | null;
  isThirdPlace: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MatchWithSets = MatchRecord & {
  sets: MatchSet[];
};

export type GroupRecord = {
  id: string;
  stageId: string;
  name: string;
  code: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupEntryRecord = {
  groupId: string;
  entryId: string;
  position: number;
  seedPosition: number | null;
};

/** Aliases used by draw persistence services. */
export type TournamentGroup = GroupRecord;
export type GroupEntry = GroupEntryRecord;
export type MatchSlot = MatchSlotSide;
export type MatchSetRecord = MatchSet;

export type StandingRuleRecord = {
  id: string;
  eventId: string;
  name: string;
  criteriaJson: string;
  specialPolicyJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QualificationRuleRecord = {
  id: string;
  sourceStageId: string;
  targetStageId: string;
  topPerGroup: number;
  bestAdditionalEntries: number;
  additionalFromRank: number | null;
  rankingCriteriaJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleRuleRecord = {
  id: string;
  eventId: string;
  stageId: string | null;
  defaultMatchDurationMinutes: number;
  minimumRestMinutes: number;
  courtChangeBufferMinutes: number;
  hardRestConflicts: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateMatchInput = {
  eventId: string;
  stageId: string;
  groupId?: string | null;
  roundNumber?: number;
  bracketPosition?: number | null;
  entryAId?: string | null;
  entryBId?: string | null;
  ruleSnapshotJson: string;
  generationKey?: string | null;
  nextMatchId?: string | null;
  nextMatchSlot?: MatchSlotSide | null;
  loserNextMatchId?: string | null;
  loserNextMatchSlot?: MatchSlotSide | null;
  isThirdPlace?: boolean;
  status?: MatchStatus;
  courtId?: string | null;
  scheduledAt?: string | null;
  estimatedDurationMinutes?: number | null;
};

export type CreateStandingRuleInput = {
  eventId: string;
  name: string;
  criteriaJson: string;
  specialPolicyJson?: string | null;
};

export type CreateQualificationRuleInput = {
  sourceStageId: string;
  targetStageId: string;
  topPerGroup: number;
  bestAdditionalEntries?: number;
  additionalFromRank?: number | null;
  rankingCriteriaJson?: string | null;
};

export type CreateScheduleRuleInput = {
  eventId: string;
  stageId?: string | null;
  defaultMatchDurationMinutes?: number;
  minimumRestMinutes?: number;
  courtChangeBufferMinutes?: number;
  hardRestConflicts?: boolean;
};

export type UpdateScheduleRuleInput = {
  defaultMatchDurationMinutes?: number;
  minimumRestMinutes?: number;
  courtChangeBufferMinutes?: number;
  hardRestConflicts?: boolean;
};
