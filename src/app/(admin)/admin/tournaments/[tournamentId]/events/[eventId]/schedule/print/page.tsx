import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import {
  CourtService,
  EntryService,
  EventService,
  StageService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { PrintScheduleButton } from "@/features/scheduling/components/print-schedule-button";
import { matchStatusKey } from "@/i18n/status-labels";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("schedule");
  const db = getDb();

  try {
    const tournament = await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    return pageTitle(t("printPreview"), event.name, tournament.name);
  } catch {
    return pageTitle(t("printPreview"));
  }
}

export default async function SchedulePrintPreviewPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("schedule");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");
  const locale = await getLocale();

  let tournament;
  let event;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  if (event.tournamentId !== tournamentId || !(await getCurrentUser())) {
    notFound();
  }

  const [courts, stages, entries, matches] = await Promise.all([
    new CourtService(db).listByTournament(tournamentId),
    new StageService(db).listByEvent(eventId),
    new EntryService(db).listByEvent(eventId),
    new DrizzleMatchRepository(db).listByEventId(eventId),
  ]);
  const entryName = new Map(entries.map((entry) => [entry.id, entry.displayName]));
  const courtName = new Map(courts.map((court) => [court.id, court.name]));
  const stageName = new Map(stages.map((stage) => [stage.id, stage.name]));
  const printableMatches = matches
    .filter(
      (
        match,
      ): match is typeof match & {
        scheduledAt: string;
      } => match.scheduledAt !== null,
    )
    .sort(
      (left, right) =>
        Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt),
    );
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: tournament.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const scheduleHref = `/admin/tournaments/${tournamentId}/events/${eventId}/schedule`;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <AdminBreadcrumbs
          tournament={{ id: tournamentId }}
          event={{ id: eventId, name: event.name }}
          current={t("printPreview")}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("printPreview")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("printPreviewDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={scheduleHref}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50"
            >
              {t("backToSchedule")}
            </Link>
            <PrintScheduleButton label={t("printSchedule")} />
          </div>
        </div>
      </div>

      <section
        className="schedule-print-area rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        aria-label={t("printTitle")}
      >
        <header className="mb-6 border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold">{t("printTitle")}</h1>
          <p className="mt-1 text-base font-semibold">{tournament.name}</p>
          <p className="mt-1 text-sm text-slate-600">
            {event.name} · {tournament.timezone}
          </p>
        </header>

        {printableMatches.length === 0 ? (
          <p className="text-sm text-slate-600">{t("printEmpty")}</p>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                <th>{t("printTime")}</th>
                <th>{t("printStage")}</th>
                <th>{t("printMatch")}</th>
                <th>{t("printCourt")}</th>
                <th>{t("printStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {printableMatches.map((match) => {
                const entryA = match.entryAId
                  ? (entryName.get(match.entryAId) ?? tc("tbd"))
                  : tc("tbd");
                const entryB = match.entryBId
                  ? (entryName.get(match.entryBId) ?? tc("tbd"))
                  : tc("tbd");

                return (
                  <tr key={match.id}>
                    <td className="whitespace-nowrap">
                      {dateTimeFormatter.format(new Date(match.scheduledAt))}
                    </td>
                    <td>{stageName.get(match.stageId) ?? tc("stage")}</td>
                    <td className="font-medium">
                      {entryA} {tc("vs")} {entryB}
                    </td>
                    <td>
                      {match.courtId
                        ? (courtName.get(match.courtId) ?? "—")
                        : "—"}
                    </td>
                    <td>{tStatus(matchStatusKey(match.status))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
