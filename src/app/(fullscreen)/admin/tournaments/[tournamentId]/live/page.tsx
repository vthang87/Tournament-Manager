import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DashboardService, TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { LiveRefresh } from "@/features/live-board/live-refresh";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";

export default async function TournamentLiveBoardPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRoleOrRedirect([
    "ADMIN",
    "OPERATOR",
    "SCOREKEEPER",
    "VIEWER",
  ]);
  const { tournamentId } = await params;
  const db = getDb();
  const t = await getTranslations("liveBoard");
  const tc = await getTranslations("common");

  let tournament;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
  } catch {
    notFound();
  }

  const board = await new DashboardService(db).liveBoard(tournamentId);

  return (
    <div className="min-h-screen space-y-8 px-4 py-6 md:px-8">
      <LiveRefresh intervalMs={12_000} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={`/admin/tournaments/${tournamentId}`}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {t("backAdmin")}
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            {tournament.name}
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            {t("updated", {
              time: new Date(board.updatedAt).toLocaleTimeString(),
            })}
          </p>
        </div>
        <Link
          href={`/t/${tournament.slug}`}
          className="text-sm text-slate-300 underline-offset-4 hover:underline"
        >
          {t("publicView")}
        </Link>
      </header>

      <section aria-labelledby="now-playing-heading">
        <h2
          id="now-playing-heading"
          className="text-sm font-medium uppercase tracking-[0.2em] text-amber-300"
        >
          {t("nowPlaying")}
        </h2>
        {board.inProgress.length === 0 ? (
          <p className="mt-4 text-2xl text-slate-400">{t("noMatchesInProgress")}</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {board.courts
              .filter((c) => c.nowPlaying)
              .map((court) => (
                <li
                  key={court.courtId}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-6"
                >
                  <p className="text-sm uppercase tracking-widest text-slate-400">
                    {court.courtName}
                  </p>
                  <p className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
                    {court.nowPlaying!.entryAName ?? tc("tbd")}
                    <span className="mx-3 text-slate-500">{tc("vs")}</span>
                    {court.nowPlaying!.entryBName ?? tc("tbd")}
                  </p>
                  <p className="mt-2 text-lg text-slate-400">
                    {court.nowPlaying!.eventName}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="upcoming-heading">
          <h2
            id="upcoming-heading"
            className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300"
          >
            {t("nextUp")}
          </h2>
          <ul className="mt-4 space-y-3">
            {board.upcoming.slice(0, 8).map((m) => (
              <li
                key={m.matchId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-3 text-xl"
              >
                <span>
                  {m.entryAName ?? tc("tbd")} {tc("vs")} {m.entryBName ?? tc("tbd")}
                </span>
                <span className="text-base text-slate-400">
                  {m.courtCode ?? t("courtTba")}
                  {m.scheduledAt
                    ? ` · ${new Date(m.scheduledAt).toLocaleTimeString()}`
                    : ""}
                </span>
              </li>
            ))}
            {board.upcoming.length === 0 ? (
              <li className="text-lg text-slate-500">{t("noUpcomingMatches")}</li>
            ) : null}
          </ul>
        </section>

        <section aria-labelledby="results-heading">
          <h2
            id="results-heading"
            className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300"
          >
            {t("recentResults")}
          </h2>
          <ul className="mt-4 space-y-3">
            {board.recentResults.map((m) => (
              <li
                key={m.matchId}
                className="border-b border-slate-800 pb-3 text-xl"
              >
                <p>
                  {m.entryAName ?? tc("tbd")} {tc("vs")} {m.entryBName ?? tc("tbd")}
                </p>
                <p className="text-base text-slate-400">
                  {m.scoreSummary || tc("dash")}
                  {m.winnerName ? ` · ${m.winnerName}` : ""}
                </p>
              </li>
            ))}
            {board.recentResults.length === 0 ? (
              <li className="text-lg text-slate-500">{t("noResultsYet")}</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
