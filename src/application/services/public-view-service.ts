import QRCode from "qrcode";
import { NotFoundError } from "@/application/errors";
import { BracketService } from "@/application/services/bracket-service";
import { StandingsService } from "@/application/services/standings-service";
import type { AppDatabase } from "@/db/client";
import {
  DrizzleCourtRepository,
  DrizzleDrawRepository,
  DrizzleMatchRepository,
  DrizzleTournamentEventRepository,
  DrizzleTournamentRepository,
} from "@/db/repositories";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import {
  DrizzleGroupRepository,
} from "@/db/repositories/schedule-repository";
import type {
  PublicBracketDto,
  PublicEntryDto,
  PublicGroupDto,
  PublicMatchDto,
  PublicStandingsGroupDto,
  PublicTournamentView,
} from "@/features/public-board/dto";

function appBaseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export class PublicViewService {
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly courts: DrizzleCourtRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly clubs: DrizzleClubRepository;
  private readonly stages: DrizzleStageRepository;
  private readonly matches: DrizzleMatchRepository;
  private readonly draw: DrizzleDrawRepository;
  private readonly groups: DrizzleGroupRepository;
  private readonly standings: StandingsService;
  private readonly brackets: BracketService;

  constructor(private readonly db: AppDatabase) {
    this.tournaments = new DrizzleTournamentRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.courts = new DrizzleCourtRepository(db);
    this.entries = new DrizzleEntryRepository(db);
    this.clubs = new DrizzleClubRepository(db);
    this.stages = new DrizzleStageRepository(db);
    this.matches = new DrizzleMatchRepository(db);
    this.draw = new DrizzleDrawRepository(db);
    this.groups = new DrizzleGroupRepository(db);
    this.standings = new StandingsService(db);
    this.brackets = new BracketService(db);
  }

  async getBySlug(slug: string): Promise<PublicTournamentView> {
    const tournament = await this.tournaments.findBySlug(slug);
    if (!tournament) {
      throw new NotFoundError(`Tournament /t/${slug} not found`);
    }

    const [eventRows, courtRows, clubs] = await Promise.all([
      this.events.listByTournamentId(tournament.id),
      this.courts.listByTournamentId(tournament.id),
      this.clubs.list(tournament.ownerUserId),
    ]);
    const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));

    const entriesByEvent: Record<string, PublicEntryDto[]> = {};
    const entryNameById = new Map<string, string>();
    const stageNameById = new Map<string, string>();
    const groupNameById = new Map<string, string>();
    const courtById = new Map(courtRows.map((c) => [c.id, c]));

    for (const event of eventRows) {
      const list = await this.entries.listByEventId(event.id);
      entriesByEvent[event.id] = list.map((entry) => {
        entryNameById.set(entry.id, entry.displayName);
        return {
          id: entry.id,
          displayName: entry.displayName,
          seed: entry.seed,
          clubName: entry.clubId
            ? (clubNameById.get(entry.clubId) ?? null)
            : null,
          status: entry.status,
        };
      });

      const stageList = await this.stages.listByEventId(event.id);
      for (const stage of stageList) {
        stageNameById.set(stage.id, stage.name);
      }
    }

    const schedule: PublicMatchDto[] = [];
    const results: PublicMatchDto[] = [];
    const groups: PublicGroupDto[] = [];
    const standings: PublicStandingsGroupDto[] = [];
    const brackets: PublicBracketDto[] = [];

    for (const event of eventRows) {
      const stageList = await this.stages.listByEventId(event.id);
      const matchRows = await this.matches.listByEventId(event.id);

      for (const match of matchRows) {
        const withSets = await this.matches.findByIdWithSets(match.id);
        const court = match.courtId ? courtById.get(match.courtId) : null;
        const dto: PublicMatchDto = {
          id: match.id,
          eventId: event.id,
          eventName: event.name,
          stageId: match.stageId,
          stageName: stageNameById.get(match.stageId) ?? "",
          groupId: match.groupId,
          groupName: match.groupId
            ? (groupNameById.get(match.groupId) ?? null)
            : null,
          roundNumber: match.roundNumber,
          bracketPosition: match.bracketPosition,
          entryAName: match.entryAId
            ? (entryNameById.get(match.entryAId) ?? null)
            : null,
          entryBName: match.entryBId
            ? (entryNameById.get(match.entryBId) ?? null)
            : null,
          winnerName: match.winnerEntryId
            ? (entryNameById.get(match.winnerEntryId) ?? null)
            : null,
          status: match.status,
          resolution: match.resolution,
          courtCode: court?.code ?? null,
          courtName: court?.name ?? null,
          scheduledAt: match.scheduledAt,
          startedAt: match.startedAt,
          completedAt: match.completedAt,
          isThirdPlace: match.isThirdPlace,
          sets:
            withSets?.sets.map((s) => ({
              setNumber: s.setNumber,
              scoreA: s.scoreA,
              scoreB: s.scoreB,
            })) ?? [],
        };

        if (
          match.status === "COMPLETED" ||
          match.status === "WALKOVER" ||
          match.winnerEntryId
        ) {
          results.push(dto);
        }
        if (match.scheduledAt || match.status === "SCHEDULED") {
          schedule.push(dto);
        } else if (
          match.status === "PENDING" ||
          match.status === "IN_PROGRESS"
        ) {
          schedule.push(dto);
        }
      }

      for (const stage of stageList) {
        if (stage.format === "GROUP") {
          const stageGroups = await this.draw.listGroupsByStageId(stage.id);
          for (const group of stageGroups) {
            groupNameById.set(group.id, group.name);
            const groupEntries = await this.groups.listEntries(group.id);
            groups.push({
              id: group.id,
              name: group.name,
              code: group.code,
              eventId: event.id,
              eventName: event.name,
              stageId: stage.id,
              stageName: stage.name,
              entries: groupEntries.map((ge) => ({
                entryId: ge.entryId,
                displayName: entryNameById.get(ge.entryId) ?? ge.entryId,
                position: ge.position,
                seedPosition: ge.seedPosition,
              })),
            });
          }

          try {
            const standingResults = await this.standings.calculateForStage(
              stage.id,
              { eventId: event.id },
            );
            for (const result of standingResults) {
              const group = stageGroups.find((g) => g.id === result.groupId);
              standings.push({
                groupId: result.groupId ?? "",
                groupName: group?.name ?? "Group",
                stageId: stage.id,
                stageName: stage.name,
                rows: result.rows.map((row) => ({
                  rank: row.rank,
                  entryId: row.entryId,
                  displayName: entryNameById.get(row.entryId) ?? row.entryId,
                  played: row.played,
                  wins: row.wins,
                  losses: row.losses,
                  setDiff: row.setDifference,
                  pointDiff: row.pointDifference,
                  tied: Boolean(row.drawRequired),
                })),
              });
            }
          } catch {
            // No standings yet — skip
          }
        }

        if (stage.format === "KNOCKOUT") {
          try {
            const bracket = await this.brackets.loadBracket(stage.id);
            brackets.push({
              stageId: stage.id,
              stageName: stage.name,
              bracketSize: bracket.bracketSize,
              roundCount: bracket.roundCount,
              thirdPlaceEnabled: bracket.thirdPlaceEnabled,
              matches: bracket.matches.map((m) => ({
                id: m.id,
                roundIndex: m.roundIndex,
                matchIndex: m.matchIndex,
                entryAName: m.slotA.entryId
                  ? (entryNameById.get(m.slotA.entryId) ?? null)
                  : null,
                entryBName: m.slotB.entryId
                  ? (entryNameById.get(m.slotB.entryId) ?? null)
                  : null,
                winnerName: m.winnerEntryId
                  ? (entryNameById.get(m.winnerEntryId) ?? null)
                  : null,
                isByeA: m.slotA.isBye,
                isByeB: m.slotB.isBye,
                isThirdPlace: m.isThirdPlace,
              })),
            });
          } catch {
            // Bracket not generated
          }
        }
      }
    }

    // Backfill group names on matches after groups loaded
    for (const dto of [...schedule, ...results]) {
      if (dto.groupId && !dto.groupName) {
        dto.groupName = groupNameById.get(dto.groupId) ?? null;
      }
    }

    const publicUrl = `${appBaseUrl()}/t/${tournament.slug}`;
    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(publicUrl, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
      });
    } catch {
      qrDataUrl = null;
    }

    return {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        description: tournament.description,
        location: tournament.location,
        timezone: tournament.timezone,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        status: tournament.status,
      },
      events: eventRows.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        genderCategory: e.genderCategory,
        status: e.status,
      })),
      courts: courtRows.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })),
      entriesByEvent,
      schedule: schedule.sort((a, b) =>
        (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""),
      ),
      results: results.sort((a, b) =>
        (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
      ),
      groups,
      standings,
      brackets,
      publicUrl,
      qrDataUrl,
    };
  }
}
