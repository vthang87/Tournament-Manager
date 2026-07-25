"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LiveBoardSnapshot } from "@/application/services/dashboard-service";
import { CountdownTimer } from "@/features/matches/countdown-timer";
import { matchSideClass } from "@/features/matches/matchup-link";
import { LiveMatchCard } from "@/features/live-board/live-match-card";
import {
  useLiveBoard,
  type LiveConnectionState,
} from "@/features/live-board/use-live-board";
import { cn } from "@/lib/utils";

type Props = {
  tournamentSlug: string;
  tournamentName: string;
  initialBoard: LiveBoardSnapshot;
};

export function LiveBoardRealtime({
  tournamentSlug,
  tournamentName,
  initialBoard,
}: Props) {
  const t = useTranslations("liveBoard");
  const tc = useTranslations("common");
  const { board, connection } = useLiveBoard(tournamentSlug, initialBoard);

  return (
    <div className="min-h-screen space-y-8 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={`/t/${tournamentSlug}`}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {t("backPublic")}
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            {tournamentName}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-slate-400">
            <span>
              {t("updated", {
                time: new Date(board.updatedAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              })}
            </span>
            <ConnectionPill state={connection} />
          </p>
        </div>
      </header>

      <section aria-labelledby="now-playing-heading">
        <h2
          id="now-playing-heading"
          className="text-sm font-medium uppercase tracking-[0.2em] text-amber-300"
        >
          {t("nowPlaying")}
        </h2>
        {board.inProgress.length === 0 ? (
          <p className="mt-4 text-2xl text-slate-400">
            {t("noMatchesInProgress")}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {board.inProgress.map((match) => (
              <LiveMatchCard
                key={match.matchId}
                courtLabel={
                  match.courtName ?? match.courtCode ?? t("courtTba")
                }
                eventName={match.eventName}
                entryAName={match.entryAName ?? tc("tbd")}
                entryBName={match.entryBName ?? tc("tbd")}
                entryAClub={match.entryAClub}
                entryBClub={match.entryBClub}
                sets={match.sets}
                startedAt={match.startedAt}
              />
            ))}
          </ul>
        )}
      </section>

      {board.preparing.length > 0 ? (
        <section aria-labelledby="preparing-heading">
          <h2
            id="preparing-heading"
            className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300"
          >
            {t("preparing")}
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {board.preparing.map((m) => (
              <li
                key={m.matchId}
                className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
                    {m.courtName ?? m.courtCode ?? t("courtTba")}
                    <span className="ml-2 font-normal text-slate-400">
                      {m.eventName}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-2xl font-semibold">
                    {m.entryAName ?? tc("tbd")}
                  </p>
                  {m.entryAClub ? (
                    <p className="text-sm text-slate-400">{m.entryAClub}</p>
                  ) : null}
                  <p className="my-0.5 text-sm text-slate-500">{tc("vs")}</p>
                  <p className="truncate text-2xl font-semibold">
                    {m.entryBName ?? tc("tbd")}
                  </p>
                  {m.entryBClub ? (
                    <p className="text-sm text-slate-400">{m.entryBClub}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                    {t("warmupCountdown")}
                  </p>
                  <CountdownTimer
                    target={m.warmupUntil}
                    readyLabel={t("warmupReady")}
                    className="block text-5xl font-bold tabular-nums text-emerald-300"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
                className="border-b border-slate-800 pb-3"
              >
                <p className="mb-1 text-right text-sm tabular-nums text-slate-400">
                  {m.courtCode ?? t("courtTba")}
                  {m.scheduledAt
                    ? ` · ${new Date(m.scheduledAt).toLocaleTimeString(
                        undefined,
                        {
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}`
                    : ""}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-xl">
                  <div className="min-w-0 text-left">
                    <p className="truncate font-medium">
                      {m.entryAName ?? tc("tbd")}
                    </p>
                    {m.entryAClub ? (
                      <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-slate-500">
                        {m.entryAClub}
                      </p>
                    ) : null}
                  </div>
                  <p className="pt-0.5 text-sm font-medium text-slate-500">
                    {tc("vs")}
                  </p>
                  <div className="min-w-0 text-right">
                    <p className="truncate font-medium">
                      {m.entryBName ?? tc("tbd")}
                    </p>
                    {m.entryBClub ? (
                      <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-slate-500">
                        {m.entryBClub}
                      </p>
                    ) : null}
                  </div>
                </div>
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
            {board.recentResults.map((m) => {
              const sets =
                m.sets.length > 0 ? m.sets : [{ scoreA: -1, scoreB: -1 }];
              const finishedAt = m.completedAt
                ? new Date(m.completedAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : null;
              return (
                <li
                  key={m.matchId}
                  className="border-b border-slate-800 pb-3"
                >
                  <p className="mb-1 flex flex-wrap items-baseline justify-end gap-x-2 text-sm text-slate-500">
                    {m.courtCode ? <span>{m.courtCode}</span> : null}
                    {finishedAt ? (
                      <span className="tabular-nums">
                        {t("finishedAt", { time: finishedAt })}
                      </span>
                    ) : null}
                    {m.resolution ? (
                      <span>
                        (
                        {m.resolution === "WALKOVER"
                          ? t("resolution.WALKOVER")
                          : m.resolution === "NO_SHOW"
                            ? t("resolution.NO_SHOW")
                            : m.resolution === "RETIREMENT"
                              ? t("resolution.RETIREMENT")
                              : m.resolution === "DISQUALIFICATION"
                                ? t("resolution.DISQUALIFICATION")
                                : m.resolution}
                        )
                      </span>
                    ) : null}
                    {m.eventName ? (
                      <span className="truncate">{m.eventName}</span>
                    ) : null}
                  </p>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-xl">
                    <div className="min-w-0 text-left">
                      <p
                        className={cn(
                          "truncate font-medium",
                          matchSideClass(m.entryAId, m.winnerEntryId, "dark"),
                        )}
                      >
                        {m.entryAName ?? tc("tbd")}
                      </p>
                      {m.entryAClub ? (
                        <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-slate-500">
                          {m.entryAClub}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 flex flex-wrap gap-x-2 tabular-nums font-semibold",
                          matchSideClass(m.entryAId, m.winnerEntryId, "dark") ||
                            "text-slate-200",
                        )}
                      >
                        {sets.map((s, i) => (
                          <span key={`a-${m.matchId}-${i}`}>
                            {s.scoreA < 0 ? tc("dash") : s.scoreA}
                          </span>
                        ))}
                      </p>
                    </div>
                    <p className="pt-0.5 text-sm font-medium text-slate-500">
                      {tc("vs")}
                    </p>
                    <div className="min-w-0 text-right">
                      <p
                        className={cn(
                          "truncate font-medium",
                          matchSideClass(m.entryBId, m.winnerEntryId, "dark"),
                        )}
                      >
                        {m.entryBName ?? tc("tbd")}
                      </p>
                      {m.entryBClub ? (
                        <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-slate-500">
                          {m.entryBClub}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 flex flex-wrap justify-end gap-x-2 tabular-nums font-semibold",
                          matchSideClass(m.entryBId, m.winnerEntryId, "dark") ||
                            "text-slate-200",
                        )}
                      >
                        {sets.map((s, i) => (
                          <span key={`b-${m.matchId}-${i}`}>
                            {s.scoreB < 0 ? tc("dash") : s.scoreB}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
            {board.recentResults.length === 0 ? (
              <li className="text-lg text-slate-500">{t("noResultsYet")}</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ConnectionPill({ state }: { state: LiveConnectionState }) {
  const t = useTranslations("liveBoard");
  const label =
    state === "live"
      ? t("connectionLive")
      : state === "polling"
        ? t("connectionPolling")
        : state === "error"
          ? t("connectionError")
          : t("connectionConnecting");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
        state === "live" && "bg-emerald-500/15 text-emerald-300",
        state === "polling" && "bg-sky-500/15 text-sky-300",
        state === "connecting" && "bg-slate-700/60 text-slate-300",
        state === "error" && "bg-red-500/15 text-red-300",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "live" && "animate-pulse bg-emerald-400",
          state === "polling" && "animate-pulse bg-sky-400",
          state === "connecting" && "bg-slate-400",
          state === "error" && "bg-red-400",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
