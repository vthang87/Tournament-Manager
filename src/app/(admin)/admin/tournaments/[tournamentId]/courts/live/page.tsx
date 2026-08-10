import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardService, TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { LiveRefresh } from "@/features/live-board/live-refresh";
import { MatchElapsedClock } from "@/features/live-board/match-elapsed-clock";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { matchStatusKey } from "@/i18n/status-labels";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const t = await getTranslations("courts");
  const db = getDb();
  try {
    const tournament = await new TournamentService(db).getById(tournamentId);
    return pageTitle(t("courtDashboard"), tournament.name);
  } catch {
    return pageTitle(t("courtDashboard"));
  }
}

export const dynamic = "force-dynamic";

export default async function CourtLivePage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRoleOrRedirect([
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR",
    "SCOREKEEPER",
    "VIEWER",
  ]);
  const { tournamentId } = await params;
  const db = getDb();
  const t = await getTranslations("courts");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");

  let tournament;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
  } catch {
    notFound();
  }

  const courts = await new DashboardService(db).courtLiveBoard(tournamentId);

  return (
    <div className="space-y-6">
      <LiveRefresh intervalMs={12_000} />
      <div>
        <AdminBreadcrumbs
          tournament={{ id: tournamentId }}
          items={[
            {
              href: `/admin/tournaments/${tournamentId}/courts`,
              label: t("title"),
            },
          ]}
          current={t("courtDashboard")}
        />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("courtDashboard")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("refreshesEvery", { name: tournament.name })}
        </p>
      </div>

      <div className="grid gap-3 sm:hidden">
        {courts.map((court) => (
          <article
            key={court.courtId}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <h2 className="font-semibold text-slate-900">
              {court.courtName}{" "}
              <span className="font-normal text-slate-500">
                ({court.courtCode})
              </span>
            </h2>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t("nowPlaying")}
              </p>
              {court.nowPlaying ? (
                <div className="mt-1">
                  <Link
                    href={`/admin/tournaments/${tournamentId}/events/${court.nowPlaying.eventId}/matches/${court.nowPlaying.matchId}`}
                    className="font-medium leading-snug underline-offset-2 hover:underline"
                  >
                    {court.nowPlaying.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                    {court.nowPlaying.entryBName ?? tc("tbd")}
                  </Link>
                  <p className="mt-1 font-semibold tabular-nums text-slate-800">
                    {court.nowPlaying.scoreSummary || tc("dash")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {court.nowPlaying.eventName} ·{" "}
                    {tStatus(matchStatusKey(court.nowPlaying.status))}
                  </p>
                  <MatchElapsedClock
                    startedAt={court.nowPlaying.startedAt}
                    compact
                    className="mt-1 text-xs"
                  />
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">{t("idle")}</p>
              )}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t("next")}
              </p>
              {court.next ? (
                <div className="mt-1">
                  <Link
                    href={`/admin/tournaments/${tournamentId}/events/${court.next.eventId}/matches/${court.next.matchId}`}
                    className="font-medium leading-snug underline-offset-2 hover:underline"
                  >
                    {court.next.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                    {court.next.entryBName ?? tc("tbd")}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {court.next.scheduledAt
                      ? new Date(court.next.scheduledAt).toLocaleString()
                      : tStatus(matchStatusKey(court.next.status))}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">{tc("dash")}</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{tc("court")}</TableHead>
              <TableHead scope="col">{t("nowPlaying")}</TableHead>
              <TableHead scope="col">{t("next")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courts.map((court) => (
              <TableRow key={court.courtId}>
                <TableCell className="font-medium">
                  {court.courtName}{" "}
                  <span className="text-slate-500">({court.courtCode})</span>
                </TableCell>
                <TableCell>
                  {court.nowPlaying ? (
                    <div>
                      <Link
                        href={`/admin/tournaments/${tournamentId}/events/${court.nowPlaying.eventId}/matches/${court.nowPlaying.matchId}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {court.nowPlaying.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                        {court.nowPlaying.entryBName ?? tc("tbd")}
                      </Link>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                        {court.nowPlaying.scoreSummary || tc("dash")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {court.nowPlaying.eventName} ·{" "}
                        {tStatus(matchStatusKey(court.nowPlaying.status))}
                      </p>
                      <MatchElapsedClock
                        startedAt={court.nowPlaying.startedAt}
                        compact
                        className="mt-1 text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-500">{t("idle")}</span>
                  )}
                </TableCell>
                <TableCell>
                  {court.next ? (
                    <div>
                      <Link
                        href={`/admin/tournaments/${tournamentId}/events/${court.next.eventId}/matches/${court.next.matchId}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {court.next.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                        {court.next.entryBName ?? tc("tbd")}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {court.next.scheduledAt
                          ? new Date(court.next.scheduledAt).toLocaleString()
                          : tStatus(matchStatusKey(court.next.status))}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-500">{tc("dash")}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
