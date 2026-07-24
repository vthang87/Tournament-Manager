import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { NotFoundError } from "@/application/errors";
import type { AppDatabase } from "@/db/client";
import {
  DrizzleCourtRepository,
  DrizzleMatchRepository,
  DrizzleTournamentEventRepository,
  DrizzleTournamentRepository,
} from "@/db/repositories";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import { courts, entries, matches, tournamentEvents } from "@/db/schema";

export type TournamentDashboardSummary = {
  tournamentId: string;
  name: string;
  slug: string;
  status: string;
  entryCount: number;
  matchesCompleted: number;
  matchesPending: number;
  matchesInProgress: number;
  courtCount: number;
  currentStages: Array<{
    eventId: string;
    eventName: string;
    stageId: string;
    stageName: string;
    stageStatus: string;
  }>;
  upcoming: Array<{
    matchId: string;
    scheduledAt: string | null;
    courtCode: string | null;
    entryAName: string | null;
    entryBName: string | null;
    eventName: string;
    status: string;
  }>;
};

export type CourtLiveSlot = {
  courtId: string;
  courtName: string;
  courtCode: string;
  nowPlaying: {
    matchId: string;
    entryAName: string | null;
    entryBName: string | null;
    eventName: string;
    startedAt: string | null;
    status: string;
  } | null;
  next: {
    matchId: string;
    entryAName: string | null;
    entryBName: string | null;
    eventName: string;
    scheduledAt: string | null;
    status: string;
  } | null;
};

export type LiveBoardSnapshot = {
  tournamentId: string;
  tournamentName: string;
  courts: CourtLiveSlot[];
  inProgress: CourtLiveSlot["nowPlaying"][];
  upcoming: TournamentDashboardSummary["upcoming"];
  recentResults: Array<{
    matchId: string;
    entryAName: string | null;
    entryBName: string | null;
    winnerName: string | null;
    eventName: string;
    courtCode: string | null;
    completedAt: string | null;
    scoreSummary: string;
  }>;
  updatedAt: string;
};

async function entryNameMap(
  db: AppDatabase,
  entryIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(entryIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) {
    return map;
  }
  const rows = await db
    .select({ id: entries.id, displayName: entries.displayName })
    .from(entries)
    .where(inArray(entries.id, unique));
  for (const row of rows) {
    map.set(row.id, row.displayName);
  }
  return map;
}

export class DashboardService {
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly courts: DrizzleCourtRepository;
  private readonly matches: DrizzleMatchRepository;
  private readonly stages: DrizzleStageRepository;

  constructor(private readonly db: AppDatabase) {
    this.tournaments = new DrizzleTournamentRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.courts = new DrizzleCourtRepository(db);
    this.matches = new DrizzleMatchRepository(db);
    this.stages = new DrizzleStageRepository(db);
  }

  async summarizeTournament(
    tournamentId: string,
  ): Promise<TournamentDashboardSummary> {
    const tournament = await this.tournaments.findById(tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${tournamentId} not found`);
    }

    const eventRows = await this.events.listByTournamentId(tournamentId);
    const eventIds = eventRows.map((e) => e.id);
    const courtRows = await this.courts.listByTournamentId(tournamentId);

    let entryCount = 0;
    let matchesCompleted = 0;
    let matchesPending = 0;
    let matchesInProgress = 0;
    const currentStages: TournamentDashboardSummary["currentStages"] = [];
    const upcoming: TournamentDashboardSummary["upcoming"] = [];

    if (eventIds.length > 0) {
      const entryCountRows = await this.db
        .select({ value: count() })
        .from(entries)
        .where(inArray(entries.eventId, eventIds));
      entryCount = entryCountRows[0]?.value ?? 0;

      const statusCounts = await this.db
        .select({ status: matches.status, value: count() })
        .from(matches)
        .where(inArray(matches.eventId, eventIds))
        .groupBy(matches.status);

      for (const row of statusCounts) {
        if (row.status === "COMPLETED" || row.status === "WALKOVER") {
          matchesCompleted += row.value;
        } else if (row.status === "IN_PROGRESS") {
          matchesInProgress += row.value;
        } else if (row.status === "PENDING" || row.status === "SCHEDULED") {
          matchesPending += row.value;
        }
      }

      for (const event of eventRows) {
        const stageList = await this.stages.listByEventId(event.id);
        const active =
          stageList.find((s) => s.status === "ACTIVE") ??
          stageList.find((s) => s.status === "PENDING") ??
          stageList[stageList.length - 1];
        if (active) {
          currentStages.push({
            eventId: event.id,
            eventName: event.name,
            stageId: active.id,
            stageName: active.name,
            stageStatus: active.status,
          });
        }
      }

      const upcomingMatches = await this.db
        .select({
          id: matches.id,
          scheduledAt: matches.scheduledAt,
          status: matches.status,
          entryAId: matches.entryAId,
          entryBId: matches.entryBId,
          eventName: tournamentEvents.name,
          courtCode: courts.code,
        })
        .from(matches)
        .innerJoin(
          tournamentEvents,
          eq(matches.eventId, tournamentEvents.id),
        )
        .leftJoin(courts, eq(matches.courtId, courts.id))
        .where(
          and(
            inArray(matches.eventId, eventIds),
            inArray(matches.status, ["PENDING", "SCHEDULED"]),
          ),
        )
        .orderBy(asc(matches.scheduledAt), asc(matches.createdAt))
        .limit(12);

      const names = await entryNameMap(
        this.db,
        upcomingMatches.flatMap((m) => [m.entryAId ?? "", m.entryBId ?? ""]),
      );

      for (const m of upcomingMatches) {
        upcoming.push({
          matchId: m.id,
          scheduledAt: m.scheduledAt,
          courtCode: m.courtCode,
          entryAName: m.entryAId ? (names.get(m.entryAId) ?? null) : null,
          entryBName: m.entryBId ? (names.get(m.entryBId) ?? null) : null,
          eventName: m.eventName,
          status: m.status,
        });
      }
    }

    return {
      tournamentId: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      status: tournament.status,
      entryCount,
      matchesCompleted,
      matchesPending,
      matchesInProgress,
      courtCount: courtRows.length,
      currentStages,
      upcoming,
    };
  }

  async summarizeAll(): Promise<TournamentDashboardSummary[]> {
    const list = await this.tournaments.list();
    return Promise.all(list.map((t) => this.summarizeTournament(t.id)));
  }

  async courtLiveBoard(tournamentId: string): Promise<CourtLiveSlot[]> {
    const tournament = await this.tournaments.findById(tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${tournamentId} not found`);
    }

    const courtRows = await this.courts.listByTournamentId(tournamentId);
    const eventRows = await this.events.listByTournamentId(tournamentId);
    const eventIds = eventRows.map((e) => e.id);
    if (eventIds.length === 0) {
      return courtRows.map((c) => ({
        courtId: c.id,
        courtName: c.name,
        courtCode: c.code,
        nowPlaying: null,
        next: null,
      }));
    }

    const matchRows = await this.db
      .select({
        id: matches.id,
        courtId: matches.courtId,
        status: matches.status,
        scheduledAt: matches.scheduledAt,
        startedAt: matches.startedAt,
        entryAId: matches.entryAId,
        entryBId: matches.entryBId,
        eventName: tournamentEvents.name,
      })
      .from(matches)
      .innerJoin(tournamentEvents, eq(matches.eventId, tournamentEvents.id))
      .where(
        and(
          inArray(matches.eventId, eventIds),
          inArray(matches.status, ["IN_PROGRESS", "SCHEDULED", "PENDING"]),
        ),
      )
      .orderBy(asc(matches.scheduledAt), asc(matches.createdAt));

    const names = await entryNameMap(
      this.db,
      matchRows.flatMap((m) => [m.entryAId ?? "", m.entryBId ?? ""]),
    );

    return courtRows.map((court) => {
      const onCourt = matchRows.filter((m) => m.courtId === court.id);
      const now = onCourt.find((m) => m.status === "IN_PROGRESS") ?? null;
      const next =
        onCourt.find(
          (m) => m.status === "SCHEDULED" || m.status === "PENDING",
        ) ?? null;

      return {
        courtId: court.id,
        courtName: court.name,
        courtCode: court.code,
        nowPlaying: now
          ? {
              matchId: now.id,
              entryAName: now.entryAId
                ? (names.get(now.entryAId) ?? null)
                : null,
              entryBName: now.entryBId
                ? (names.get(now.entryBId) ?? null)
                : null,
              eventName: now.eventName,
              startedAt: now.startedAt,
              status: now.status,
            }
          : null,
        next: next
          ? {
              matchId: next.id,
              entryAName: next.entryAId
                ? (names.get(next.entryAId) ?? null)
                : null,
              entryBName: next.entryBId
                ? (names.get(next.entryBId) ?? null)
                : null,
              eventName: next.eventName,
              scheduledAt: next.scheduledAt,
              status: next.status,
            }
          : null,
      };
    });
  }

  async liveBoard(tournamentId: string): Promise<LiveBoardSnapshot> {
    const summary = await this.summarizeTournament(tournamentId);
    const courtsLive = await this.courtLiveBoard(tournamentId);
    const eventRows = await this.events.listByTournamentId(tournamentId);
    const eventIds = eventRows.map((e) => e.id);

    const recentResults: LiveBoardSnapshot["recentResults"] = [];
    if (eventIds.length > 0) {
      const completed = await this.db
        .select({
          id: matches.id,
          entryAId: matches.entryAId,
          entryBId: matches.entryBId,
          winnerEntryId: matches.winnerEntryId,
          completedAt: matches.completedAt,
          eventName: tournamentEvents.name,
          courtCode: courts.code,
        })
        .from(matches)
        .innerJoin(
          tournamentEvents,
          eq(matches.eventId, tournamentEvents.id),
        )
        .leftJoin(courts, eq(matches.courtId, courts.id))
        .where(
          and(
            inArray(matches.eventId, eventIds),
            inArray(matches.status, ["COMPLETED", "WALKOVER"]),
          ),
        )
        .orderBy(sql`${matches.completedAt} desc`)
        .limit(8);

      const names = await entryNameMap(
        this.db,
        completed.flatMap((m) => [
          m.entryAId ?? "",
          m.entryBId ?? "",
          m.winnerEntryId ?? "",
        ]),
      );

      for (const m of completed) {
        const withSets = await this.matches.findByIdWithSets(m.id);
        const scoreSummary =
          withSets?.sets
            .map((s) => `${s.scoreA}-${s.scoreB}`)
            .join(", ") ?? "";
        recentResults.push({
          matchId: m.id,
          entryAName: m.entryAId ? (names.get(m.entryAId) ?? null) : null,
          entryBName: m.entryBId ? (names.get(m.entryBId) ?? null) : null,
          winnerName: m.winnerEntryId
            ? (names.get(m.winnerEntryId) ?? null)
            : null,
          eventName: m.eventName,
          courtCode: m.courtCode,
          completedAt: m.completedAt,
          scoreSummary,
        });
      }
    }

    return {
      tournamentId: summary.tournamentId,
      tournamentName: summary.name,
      courts: courtsLive,
      inProgress: courtsLive
        .map((c) => c.nowPlaying)
        .filter((m): m is NonNullable<typeof m> => m != null),
      upcoming: summary.upcoming,
      recentResults,
      updatedAt: new Date().toISOString(),
    };
  }
}
