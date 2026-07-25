import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fromZonedTime } from "date-fns-tz";
import {
  CourtService,
  EntryService,
  EventService,
  ScheduleService,
  StageService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { ScheduleBoard } from "@/features/scheduling/components/schedule-board";
import { buildTimeSlots } from "@/features/scheduling/lib/timezone";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";

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

  const [courts, stages, entries, scheduleService] = await Promise.all([
    new CourtService(db).listByTournament(tournamentId),
    new StageService(db).listByEvent(eventId),
    new EntryService(db).listByEvent(eventId),
    Promise.resolve(new ScheduleService(db)),
  ]);

  const matchRepo = new DrizzleMatchRepository(db);
  const matches = await matchRepo.listByEventId(eventId);
  const entryName = new Map(entries.map((e) => [e.id, e.displayName]));
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  const rule = await scheduleService.resolveRule(eventId);
  const { startUtc, endUtc } = resolveDayWindowUtc(tournament);
  const timeSlots = buildTimeSlots(startUtc, endUtc, 30);

  const user = await getCurrentUser();
  const canSchedule = user ? canPerform(user.role, "schedule") : false;

  const matchDtos = matches.map((m) => {
    const a = m.entryAId ? (entryName.get(m.entryAId) ?? "?") : tc("tbd");
    const b = m.entryBId ? (entryName.get(m.entryBId) ?? "?") : tc("tbd");
    return {
      id: m.id,
      label: `${a} ${tc("vs")} ${b}`,
      status: m.status,
      courtId: m.courtId,
      scheduledAt: m.scheduledAt,
      estimatedDurationMinutes: m.estimatedDurationMinutes,
      stageName: stageName.get(m.stageId) ?? tc("stage"),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {event.name}
        </Link>
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
          tournamentId={tournamentId}
          eventId={eventId}
          timeZone={tournament.timezone}
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            active: c.active,
          }))}
          matches={matchDtos}
          timeSlots={timeSlots}
          defaultDurationMinutes={rule.defaultMatchDurationMinutes}
          canSchedule={canSchedule}
          matchDetailBase={`/admin/tournaments/${tournamentId}/events/${eventId}/matches`}
        />
      )}
    </div>
  );
}
