"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BracketMatchView, BracketBoardView } from "../lib/build-bracket-view";

function SlotLine({
  label,
  meta,
  winner,
}: {
  label: string;
  meta?: string | null;
  winner?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 border-b border-slate-200 px-2 py-1.5 text-sm last:border-b-0 ${
        winner ? "bg-emerald-50 font-medium text-emerald-900" : "bg-white"
      }`}
    >
      <span className="truncate">{label}</span>
      {meta ? (
        <span className="shrink-0 text-[11px] text-slate-500">{meta}</span>
      ) : null}
    </div>
  );
}

function slotMeta(slot: BracketMatchView["slotA"]): string | null {
  const parts: string[] = [];
  if (slot.qualificationSeed != null) parts.push(`Q#${slot.qualificationSeed}`);
  if (slot.entrySeed != null) parts.push(`S${slot.entrySeed}`);
  if (slot.groupCode != null) {
    parts.push(
      slot.sourceRank != null
        ? `${slot.groupCode}${slot.sourceRank}`
        : slot.groupCode,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function MatchCard({
  match,
  href,
  tCommon,
}: {
  match: BracketMatchView;
  href: string | null;
  tCommon: ReturnType<typeof useTranslations<"common">>;
}) {
  const body = (
    <div className="overflow-hidden rounded-md border border-slate-300 shadow-sm print:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
        <span>
          M{match.matchIndex + 1}
          {match.isThirdPlace ? tCommon("thirdSuffix") : ""}
        </span>
        <span>{match.status}</span>
      </div>
      <SlotLine
        label={match.slotA.isBye ? tCommon("bye") : (match.slotA.displayName ?? tCommon("tbd"))}
        meta={match.slotA.isBye ? null : slotMeta(match.slotA)}
        winner={
          match.winnerEntryId != null &&
          match.winnerEntryId === match.slotA.entryId
        }
      />
      <SlotLine
        label={match.slotB.isBye ? tCommon("bye") : (match.slotB.displayName ?? tCommon("tbd"))}
        meta={match.slotB.isBye ? null : slotMeta(match.slotB)}
        winner={
          match.winnerEntryId != null &&
          match.winnerEntryId === match.slotB.entryId
        }
      />
      {match.scoreText ? (
        <p className="border-t border-slate-100 px-2 py-1 text-center text-xs text-slate-600">
          {match.scoreText}
        </p>
      ) : null}
    </div>
  );

  if (!href) {
    return body;
  }
  return (
    <Link href={href} className="block transition hover:ring-2 hover:ring-slate-400">
      {body}
    </Link>
  );
}

export function BracketBoard({
  board,
  tournamentId,
  eventId,
}: {
  board: BracketBoardView;
  tournamentId: string;
  eventId: string;
}) {
  const tCommon = useTranslations("common");
  const [activeRound, setActiveRound] = useState(0);
  const matchHref = (matchId: string) =>
    `/admin/tournaments/${tournamentId}/events/${eventId}/matches/${matchId}`;

  const mobileRound = useMemo(
    () => board.rounds[activeRound] ?? board.rounds[0],
    [board.rounds, activeRound],
  );

  return (
    <div className="space-y-4">
      {/* Mobile: round tabs */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {board.rounds.map((round, idx) => (
            <button
              key={round.roundIndex}
              type="button"
              onClick={() => setActiveRound(idx)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                idx === activeRound
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {round.label}
            </button>
          ))}
        </div>
        {mobileRound ? (
          <div className="space-y-3">
            {mobileRound.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                href={matchHref(match.id)}
                tCommon={tCommon}
              />
            ))}
          </div>
        ) : null}
        {board.thirdPlace ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">
              {tCommon("thirdPlace")}
            </p>
            <MatchCard
              match={board.thirdPlace}
              href={matchHref(board.thirdPlace.id)}
              tCommon={tCommon}
            />
          </div>
        ) : null}
      </div>

      {/* Desktop: columns + connectors */}
      <div className="bracket-print-area hidden overflow-x-auto md:block">
        <div className="inline-flex min-w-full gap-0">
          {board.rounds.map((round, roundIdx) => (
            <div
              key={round.roundIndex}
              className="flex min-w-[200px] flex-col"
              style={{ flex: 1 }}
            >
              <p className="mb-3 px-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {round.label}
              </p>
              <div
                className="flex flex-1 flex-col justify-around gap-4 px-2"
                style={{
                  minHeight: `${Math.max(round.matches.length, 1) * 110}px`,
                }}
              >
                {round.matches.map((match) => (
                  <div
                    key={match.id}
                    className="relative"
                    style={{
                      marginBlock:
                        roundIdx === 0
                          ? 0
                          : `${Math.pow(2, roundIdx - 1) * 12}px`,
                    }}
                  >
                    {roundIdx > 0 ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 -left-2 h-px w-2 border-t border-slate-300"
                      />
                    ) : null}
                    {roundIdx < board.rounds.length - 1 ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 right-0 h-px w-2 border-t border-slate-300"
                      />
                    ) : null}
                    <MatchCard match={match} href={matchHref(match.id)} tCommon={tCommon} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {board.thirdPlace ? (
          <div className="mt-6 max-w-xs">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {tCommon("thirdPlace")}
            </p>
            <MatchCard
              match={board.thirdPlace}
              href={matchHref(board.thirdPlace.id)}
              tCommon={tCommon}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
