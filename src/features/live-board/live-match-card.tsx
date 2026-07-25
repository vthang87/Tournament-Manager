"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type LiveSet = { scoreA: number; scoreB: number };

type Props = {
  courtLabel: string;
  eventName: string;
  entryAName: string;
  entryBName: string;
  entryAClub?: string | null;
  entryBClub?: string | null;
  sets: LiveSet[];
  startedAt: string | null;
};

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function elapsedMinutes(startedAt: string, nowMs: number): number {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 60_000));
}

/** TV-style live scoreboard: pair rows + set columns. */
export function LiveMatchCard({
  courtLabel,
  eventName,
  entryAName,
  entryBName,
  entryAClub,
  entryBClub,
  sets,
  startedAt,
}: Props) {
  const t = useTranslations("liveBoard");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const displaySets =
    sets.length > 0 ? sets : [{ scoreA: 0, scoreB: 0 } satisfies LiveSet];
  const currentSetIndex = displaySets.length - 1;
  const mins = startedAt ? elapsedMinutes(startedAt, now) : null;
  const startLabel = startedAt ? formatStartTime(startedAt) : null;

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_0_1px_rgba(15,23,42,0.6)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
              {courtLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                aria-hidden
              />
              {t("liveBadge")}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-400">{eventName}</p>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          {startLabel ? (
            <>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {t("elapsed")}
              </p>
              <p className="text-lg font-semibold text-amber-200">
                {t("elapsedMinutes", { mins: mins ?? 0 })}
              </p>
              <p className="text-xs text-slate-500">
                {t("startTime")} {startLabel}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">{t("startTimeUnknown")}</p>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <div
          className="mb-2 grid items-end gap-2"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) repeat(${displaySets.length}, minmax(2.75rem, 3.25rem))`,
          }}
        >
          <span className="sr-only">{t("scoreboard")}</span>
          <span aria-hidden className="min-w-0" />
          {displaySets.map((_, index) => (
            <span
              key={`set-h-${index}`}
              className={cn(
                "text-center text-[10px] font-semibold uppercase tracking-wider",
                index === currentSetIndex
                  ? "text-amber-300"
                  : "text-slate-500",
              )}
            >
              {t("setShort", { n: index + 1 })}
            </span>
          ))}
        </div>

        <SideRow
          name={entryAName}
          club={entryAClub}
          scores={displaySets.map((s) => s.scoreA)}
          currentSetIndex={currentSetIndex}
          leading={leadingSide(displaySets, "A")}
        />
        <div className="my-2 border-t border-slate-800/70" />
        <SideRow
          name={entryBName}
          club={entryBClub}
          scores={displaySets.map((s) => s.scoreB)}
          currentSetIndex={currentSetIndex}
          leading={leadingSide(displaySets, "B")}
        />
      </div>
    </li>
  );
}

function leadingSide(
  sets: LiveSet[],
  side: "A" | "B",
): boolean {
  const current = sets[sets.length - 1];
  if (!current) return false;
  if (side === "A") return current.scoreA > current.scoreB;
  return current.scoreB > current.scoreA;
}

function SideRow({
  name,
  club,
  scores,
  currentSetIndex,
  leading,
}: {
  name: string;
  club?: string | null;
  scores: number[];
  currentSetIndex: number;
  leading: boolean;
}) {
  return (
    <div
      className="grid items-center gap-2"
      style={{
        gridTemplateColumns: `minmax(0, 1fr) repeat(${scores.length}, minmax(2.75rem, 3.25rem))`,
      }}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-xl font-semibold leading-snug tracking-tight md:text-2xl",
            leading ? "text-white" : "text-slate-300",
          )}
          title={name}
        >
          {name}
        </p>
        {club ? (
          <p
            className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-slate-500 md:text-sm"
            title={club}
          >
            {club}
          </p>
        ) : null}
      </div>
      {scores.map((score, index) => {
        const isCurrent = index === currentSetIndex;
        return (
          <p
            key={`s-${index}`}
            className={cn(
              "rounded-lg text-center font-semibold tabular-nums",
              isCurrent
                ? "bg-amber-400/15 py-1.5 text-3xl text-amber-200 md:text-4xl"
                : "py-1.5 text-2xl text-slate-400 md:text-3xl",
            )}
          >
            {score}
          </p>
        );
      })}
    </div>
  );
}
