import { NotFoundError } from "@/application/errors";
import { createMatchOpsService } from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleCourtRepository } from "@/db/repositories/court-repository";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { clubs, courts, entries, tournamentEvents } from "@/db/schema";
import { formatClubLabel } from "@/features/draw/lib/ceremony-order";
import { readCourtAccessSession } from "@/lib/auth/court-session";
import { eq, inArray } from "drizzle-orm";
import type { CourtQueueMatch, CourtScoringBoard } from "./actions";

export async function loadCourtScoringBoard(
  slug: string,
  code: string,
): Promise<CourtScoringBoard> {
  const db = getDb();
  const tournament = await new DrizzleTournamentRepository(db).findBySlug(slug);
  if (!tournament) {
    throw new NotFoundError("Tournament not found");
  }

  const court = await new DrizzleCourtRepository(db).findByTournamentAndCode(
    tournament.id,
    code,
  );
  if (!court || !court.active || !court.hasAccessPin) {
    throw new NotFoundError("Court scoring not available");
  }

  const session = await readCourtAccessSession();
  const unlocked =
    session?.courtId === court.id &&
    session.tournamentId === tournament.id;

  if (!unlocked) {
    return {
      unlocked: false,
      court: { id: court.id, name: court.name, code: court.code },
      tournamentName: tournament.name,
      inProgress: null,
      nextAssigned: null,
      queue: [],
      entryLabels: {},
      entryClubs: {},
    };
  }

  const matchesRepo = new DrizzleMatchRepository(db);
  const inProgressRow = await matchesRepo.findInProgressOnCourt(court.id);
  const selectable = await matchesRepo.listSelectableForCourt(
    tournament.id,
    court.id,
  );

  let inProgress = null;
  if (inProgressRow) {
    inProgress = await createMatchOpsService(db).getById(inProgressRow.id);
  }

  const eventIds = [
    ...new Set([
      ...(inProgress ? [inProgress.eventId] : []),
      ...selectable.map((m) => m.eventId),
    ]),
  ];
  const eventNameById = new Map<string, string>();
  if (eventIds.length > 0) {
    const eventRows = await db
      .select({ id: tournamentEvents.id, name: tournamentEvents.name })
      .from(tournamentEvents)
      .where(inArray(tournamentEvents.id, eventIds));
    for (const row of eventRows) {
      eventNameById.set(row.id, row.name);
    }
  }

  const otherCourtIds = [
    ...new Set(
      selectable
        .map((m) => m.courtId)
        .filter((id): id is string => Boolean(id) && id !== court.id),
    ),
  ];
  const courtCodeById = new Map<string, string>();
  if (otherCourtIds.length > 0) {
    const courtRows = await db
      .select({ id: courts.id, code: courts.code })
      .from(courts)
      .where(inArray(courts.id, otherCourtIds));
    for (const row of courtRows) {
      courtCodeById.set(row.id, row.code);
    }
  }

  const queue: CourtQueueMatch[] = selectable.map((m) => ({
    id: m.id,
    entryAId: m.entryAId,
    entryBId: m.entryBId,
    status: m.status,
    updatedAt: m.updatedAt,
    eventName: eventNameById.get(m.eventId) ?? "",
    warmupUntil: m.warmupUntil,
    scheduledAt: m.scheduledAt,
    onThisCourt: m.courtId === court.id,
    assignedCourtCode:
      m.courtId && m.courtId !== court.id
        ? (courtCodeById.get(m.courtId) ?? null)
        : null,
  }));

  const entryIds = [
    inProgress?.entryAId,
    inProgress?.entryBId,
    ...queue.flatMap((m) => [m.entryAId, m.entryBId]),
  ].filter((id): id is string => Boolean(id));

  const entryLabels: Record<string, string> = {};
  const entryClubs: Record<string, string> = {};
  if (entryIds.length > 0) {
    const rows = await db
      .select({
        id: entries.id,
        displayName: entries.displayName,
        clubShortName: clubs.shortName,
        clubName: clubs.name,
      })
      .from(entries)
      .leftJoin(clubs, eq(entries.clubId, clubs.id))
      .where(inArray(entries.id, [...new Set(entryIds)]));
    for (const row of rows) {
      entryLabels[row.id] = row.displayName;
      const clubLabel = formatClubLabel(row.clubShortName, row.clubName);
      if (clubLabel) {
        entryClubs[row.id] = clubLabel;
      }
    }
  }

  return {
    unlocked: true,
    court: { id: court.id, name: court.name, code: court.code },
    tournamentName: tournament.name,
    inProgress,
    nextAssigned: queue[0] ?? null,
    queue,
    entryLabels,
    entryClubs,
  };
}
