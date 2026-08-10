/**
 * Public-facing DTOs — never include phone, email, audit, or user fields.
 */

export type PublicTournamentDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

export type PublicEventDto = {
  id: string;
  name: string;
  type: string;
  genderCategory: string;
  status: string;
};

export type PublicCourtDto = {
  id: string;
  name: string;
  code: string;
};

export type PublicEntryDto = {
  id: string;
  displayName: string;
  seed: number | null;
  clubName: string | null;
  status: string;
};

export type PublicGroupDto = {
  id: string;
  name: string;
  code: string;
  eventId: string;
  eventName: string;
  stageId: string;
  stageName: string;
  entries: Array<{
    entryId: string;
    displayName: string;
    position: number;
    seedPosition: number | null;
  }>;
};

export type PublicMatchSetDto = {
  setNumber: number;
  scoreA: number;
  scoreB: number;
};

export type PublicMatchDto = {
  id: string;
  eventId: string;
  eventName: string;
  stageId: string;
  stageName: string;
  groupId: string | null;
  groupName: string | null;
  roundNumber: number;
  bracketPosition: number | null;
  entryAName: string | null;
  entryBName: string | null;
  winnerName: string | null;
  status: string;
  resolution: string | null;
  courtCode: string | null;
  courtName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  isThirdPlace: boolean;
  sets: PublicMatchSetDto[];
};

export type PublicStandingRowDto = {
  rank: number;
  entryId: string;
  displayName: string;
  played: number;
  wins: number;
  losses: number;
  setDiff: number;
  pointDiff: number;
  tied: boolean;
};

export type PublicStandingsGroupDto = {
  groupId: string;
  groupName: string;
  stageId: string;
  stageName: string;
  rows: PublicStandingRowDto[];
};

export type PublicBracketMatchDto = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  entryAName: string | null;
  entryBName: string | null;
  winnerName: string | null;
  isByeA: boolean;
  isByeB: boolean;
  isThirdPlace: boolean;
};

export type PublicBracketDto = {
  stageId: string;
  stageName: string;
  bracketSize: number;
  roundCount: number;
  thirdPlaceEnabled: boolean;
  matches: PublicBracketMatchDto[];
};

export type PublicTournamentView = {
  tournament: PublicTournamentDto;
  events: PublicEventDto[];
  courts: PublicCourtDto[];
  entriesByEvent: Record<string, PublicEntryDto[]>;
  schedule: PublicMatchDto[];
  results: PublicMatchDto[];
  groups: PublicGroupDto[];
  standings: PublicStandingsGroupDto[];
  brackets: PublicBracketDto[];
  publicUrl: string;
  qrDataUrl: string | null;
};
