import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { fromZonedTime } from "date-fns-tz";
import {
  ClubService,
  CourtService,
  EntryService,
  EventService,
  ScheduleService,
  StageService,
  TournamentAccessService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { ScheduleBoard } from "@/features/scheduling/components/schedule-board";
import { buildTimeSlots } from "@/features/scheduling/lib/timezone";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";
import { formatClubLabel } from "@/lib/club-label";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("schedule");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    return pageTitle(t("title"), event.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

function resolveDayWindowUtc(tournament: {
  startDate: string | null;
  timezone: string;
}): { startUtc: string; endUtc: string } {
  const tz = tournament.timezone || "UTC";
  const day = tournament.startDate ?? new Date().toISOString().slice(0, 10);
  const startUtc = fromZonedTime(`${day}T08:00:00`, tz).toISOString();
  const endUtc = fromZonedTime(`${day}T22:00:00`, tz).toISOString();
  return { startUtc, endUtc };
}

export default async function EventSchedulePage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("schedule");
  const tc = await getTranslations("common");
  const te = await getTranslations("events");
  const tCourts = await getTranslations("courts");

  let tournament;
  let event;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }
  if (event.tournamentId !== tournamentId) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  const actor = { userId: user.id, role: user.role };
  const [courts, stages, entries, clubs, scheduleService] = await Promise.all([
    new CourtService(db).listByTournament(tournamentId),
    new StageService(db).listByEvent(eventId),
    new EntryService(db).listByEvent(eventId),
    new ClubService(db).listForTournament(actor, tournamentId),
    Promise.resolve(new ScheduleService(db)),
  ]);

  const matchRepo = new DrizzleMatchRepository(db);
  const matches = await matchRepo.listByEventId(eventId);
  const entryName = new Map(entries.map((e) => [e.id, e.displayName]));
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const entryClub = new Map(
    entries.map((e) => {
      const club = e.clubId ? clubById.get(e.clubId) : undefined;
      return [
        e.id,
        formatClubLabel(club?.shortName, club?.name),
      ] as const;
    }),
  );
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  const rule = await scheduleService.resolveRule(eventId);
  const { startUtc, endUtc } = resolveDayWindowUtc(tournament);
  const scheduledDurations = new Set(
    matches
      .filter((match) => match.scheduledAt)
      .map(
        (match) =>
          match.estimatedDurationMinutes ?? rule.defaultMatchDurationMinutes,
      ),
  );
  const onlyDuration =
    scheduledDurations.size === 1 ? [...scheduledDurations][0] : undefined;
  const configuredGridMinutes =
    (onlyDuration ?? rule.defaultMatchDurationMinutes) +
    event.scheduleRestMinutes;
  const gridMinutes =
    configuredGridMinutes > 0 && configuredGridMinutes <= 120
      ? configuredGridMinutes
      : 30;
  const timeSlots = [
    ...new Set([
      ...buildTimeSlots(startUtc, endUtc, gridMinutes),
      ...matches.flatMap((match) =>
        match.scheduledAt ? [match.scheduledAt] : [],
      ),
    ]),
  ].sort((left, right) => Date.parse(left) - Date.parse(right));

  const access = await new TournamentAccessService(db).resolve(
    actor,
    tournamentId,
  );
  const canSchedule = canPerform(access.role, "schedule");

  const matchDtos = matches.map((m) => {
    const a = m.entryAId ? (entryName.get(m.entryAId) ?? "?") : tc("tbd");
    const b = m.entryBId ? (entryName.get(m.entryBId) ?? "?") : tc("tbd");
    const clubA = m.entryAId ? (entryClub.get(m.entryAId) ?? null) : null;
    const clubB = m.entryBId ? (entryClub.get(m.entryBId) ?? null) : null;
    const clubParts = [clubA, clubB].filter(Boolean);
    return {
      id: m.id,
      stageId: m.stageId,
      label: `${a} ${tc("vs")} ${b}`,
      clubLabel: clubParts.length > 0 ? clubParts.join(" · ") : null,
      status: m.status,
      courtId: m.courtId,
      scheduledAt: m.scheduledAt,
      estimatedDurationMinutes: m.estimatedDurationMinutes,
      stageName: stageName.get(m.stageId) ?? tc("stage"),
      schedulable:
        ["PENDING", "SCHEDULED"].includes(m.status) &&
        Boolean(m.entryAId && m.entryBId),
    };
  });
  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumbs
          tournament={{ id: tournamentId }}
          event={{ id: eventId, name: event.name }}
          current={t("title")}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("subtitle", {
                tournament: tournament.name,
                timezone: tournament.timezone,
                minutes: rule.defaultMatchDurationMinutes,
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/schedule/print`}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              {t("printSchedule")}
            </Link>
            <Link
              href={`/admin/tournaments/${tournamentId}/schedule`}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              {t("tournamentSchedule")}
            </Link>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/${eventId}/bracket`}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              {te("bracket")}
            </Link>
            <Link
              href={`/admin/tournaments/${tournamentId}/courts`}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
            >
              {tCourts("title")}
            </Link>
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
          {t("noMatchesGenerate")}
        </div>
      ) : (
        <ScheduleBoard
          key={matchDtos
            .map(
              (match) =>
                `${match.id}:${match.courtId ?? ""}:${match.scheduledAt ?? ""}`,
            )
            .join("|")}
          tournamentId={tournamentId}
          eventId={eventId}
          timeZone={tournament.timezone}
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            active: c.active,
          }))}
          stages={stages.map((stage) => ({
            id: stage.id,
            name: stage.name,
            orderIndex: stage.orderIndex,
            status: stage.status,
          }))}
          matches={matchDtos}
          timeSlots={timeSlots}
          defaultDurationMinutes={rule.defaultMatchDurationMinutes}
          defaultRestMinutes={event.scheduleRestMinutes}
          canSchedule={canSchedule}
          scheduleLocked={Boolean(event.scheduleLockedAt)}
          matchDetailBase={`/admin/tournaments/${tournamentId}/events/${eventId}/matches`}
        />
      )}
    </div>
  );
}
