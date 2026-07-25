"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type {
  BracketBoardView,
  BracketMatchView,
  BracketSlotView,
} from "@/features/bracket/lib/build-bracket-view";
import { cn } from "@/lib/utils";
import { localizeRoundLabel } from "./localize-round-label";

const CARD_W = 212;
const CARD_HEADER_H = 22;
const ROW_H = 28;
const CARD_H = CARD_HEADER_H + ROW_H * 2;
const SET_SCORE_W = 22;
const COL_GAP = 64;
const PAD_X = 20;
const PAD_Y = 16;
const VERT_GAP = 24;
const ROUND_LABEL_H = 30;
/** Vertical gap between the final and the 3rd-place match (same column). */
const THIRD_GAP = 28;

function cardLeft(columnIndex: number): number {
  return PAD_X + columnIndex * (CARD_W + COL_GAP);
}

function firstRoundTop(rowIndex: number): number {
  return PAD_Y + ROUND_LABEL_H + rowIndex * (CARD_H + VERT_GAP);
}

function slotTop(roundIndex: number, matchIndex: number): number {
  const slot = (CARD_H + VERT_GAP) * 2 ** roundIndex;
  return PAD_Y + ROUND_LABEL_H + matchIndex * slot + (slot - CARD_H) / 2;
}

function orthogonalPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
}

/** Vertical drop then horizontal into the 3rd-place node. */
function dropPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
}

function slotName(
  slot: BracketSlotView,
  labels: { tbd: string; bye: string },
): string {
  if (slot.isBye) return labels.bye;
  return slot.displayName ?? labels.tbd;
}

function SetScoreColumns({
  scores,
  setCount,
  highlight,
}: {
  scores: number[];
  setCount: number;
  highlight: boolean;
}) {
  if (setCount === 0) return null;

  return (
    <div className="flex h-full shrink-0 items-stretch self-stretch border-l border-slate-600/70">
      {Array.from({ length: setCount }, (_, index) => (
        <span
          key={index}
          className={cn(
            "flex items-center justify-center border-l border-slate-700/70 font-mono text-[11px] tabular-nums first:border-l-0",
            highlight ? "text-emerald-300" : "text-slate-400",
          )}
          style={{ width: SET_SCORE_W }}
        >
          {scores[index] ?? ""}
        </span>
      ))}
    </div>
  );
}

function TeamRow({
  name,
  scores,
  setCount,
  isWinner,
  isLoser,
  isBye,
  showScoreDivider,
}: {
  name: string;
  scores: number[];
  setCount: number;
  isWinner: boolean;
  isLoser: boolean;
  isBye: boolean;
  showScoreDivider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-0 border-l-2",
        showScoreDivider && "border-t border-slate-700/80",
        isWinner
          ? "border-emerald-400 bg-emerald-500/10"
          : "border-transparent",
      )}
      style={{ height: ROW_H }}
    >
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center truncate px-2 text-xs",
          isWinner && "font-semibold text-emerald-200",
          isLoser && "text-slate-500",
          !isWinner && !isLoser && (isBye ? "text-slate-500" : "text-slate-200"),
        )}
      >
        {name}
      </span>
      <SetScoreColumns
        scores={scores}
        setCount={setCount}
        highlight={isWinner}
      />
    </div>
  );
}

function MatchNodeCard({
  match,
  href,
  labels,
  statusLabel,
  code,
}: {
  match: BracketMatchView;
  href: string;
  labels: { tbd: string; bye: string };
  statusLabel: string;
  code: string;
}) {
  const decided = match.winnerEntryId != null;
  const aWin = decided && match.winnerEntryId === match.slotA.entryId;
  const bWin = decided && match.winnerEntryId === match.slotB.entryId;
  const setCount = match.setScores.length;
  const scoresA = match.setScores.map((s) => s.scoreA);
  const scoresB = match.setScores.map((s) => s.scoreB);

  return (
    <Link
      href={href}
      className={cn(
        "block h-full w-full overflow-hidden rounded-md border bg-slate-800 shadow-sm transition",
        "hover:border-orange-400/70 hover:ring-1 hover:ring-orange-400/40",
        match.status === "IN_PROGRESS"
          ? "border-amber-400/70"
          : "border-slate-600/80",
      )}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/70 px-2"
        style={{ height: CARD_HEADER_H }}
      >
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {code}
        </span>
        <span
          className={cn(
            "shrink-0 text-[10px] font-medium",
            match.status === "IN_PROGRESS"
              ? "text-amber-300"
              : match.status === "COMPLETED" || match.status === "WALKOVER"
                ? "text-emerald-300/80"
                : "text-slate-500",
          )}
        >
          {statusLabel}
        </span>
      </div>
      <TeamRow
        name={slotName(match.slotA, labels)}
        scores={scoresA}
        setCount={setCount}
        isWinner={aWin}
        isLoser={decided && !aWin}
        isBye={match.slotA.isBye}
      />
      <TeamRow
        name={slotName(match.slotB, labels)}
        scores={scoresB}
        setCount={setCount}
        isWinner={bWin}
        isLoser={decided && !bWin}
        isBye={match.slotB.isBye}
        showScoreDivider
      />
    </Link>
  );
}

function AbsoluteCard({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute"
      style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
    >
      {children}
    </div>
  );
}

export function MatchBracketOrgChart({
  board,
  tournamentId,
  eventId,
  dropFromMatchIds = [],
}: {
  board: BracketBoardView;
  tournamentId: string;
  eventId: string;
  dropFromMatchIds?: string[];
}) {
  const tc = useTranslations("common");
  const t = useTranslations("orgChart");
  const tStatus = useTranslations("status.match");
  const labels = useMemo(
    () => ({ tbd: tc("tbd"), bye: tc("bye") }),
    [tc],
  );
  const href = (id: string) =>
    `/admin/tournaments/${tournamentId}/events/${eventId}/matches/${id}`;
  const matchCode = (match: BracketMatchView) =>
    match.isThirdPlace
      ? t("thirdPlace")
      : `${localizeRoundLabel(match.roundLabel, t)} · M${match.matchIndex + 1}`;

  const layout = useMemo(() => {
    const rounds = board.rounds;
    if (rounds.length === 0 && !board.thirdPlace) return null;

    const centers = new Map<string, { x: number; cy: number; bottom: number }>();
    const nodes: Array<{ match: BracketMatchView; x: number; y: number }> = [];
    const edges: string[] = [];
    const dashedEdges: string[] = [];

    for (const round of rounds) {
      const prev = rounds.find((r) => r.roundIndex === round.roundIndex - 1);
      for (const match of round.matches) {
        const x = cardLeft(round.roundIndex);
        const feeders =
          prev?.matches.filter((m) =>
            m.nextMatchId != null
              ? m.nextMatchId === match.id
              : Math.floor(m.matchIndex / 2) === match.matchIndex,
          ) ?? [];
        const feederCenters = feeders
          .map((f) => centers.get(f.id)?.cy)
          .filter((c): c is number => c != null);

        let top: number;
        if (round.roundIndex === 0) {
          top = firstRoundTop(match.matchIndex);
        } else if (feederCenters.length > 0) {
          const mid =
            feederCenters.reduce((sum, c) => sum + c, 0) / feederCenters.length;
          top = mid - CARD_H / 2;
        } else {
          top = slotTop(round.roundIndex, match.matchIndex);
        }

        const cy = top + CARD_H / 2;
        centers.set(match.id, { x, cy, bottom: top + CARD_H });
        nodes.push({ match, x, y: top });

        for (const feeder of feeders) {
          const from = centers.get(feeder.id);
          if (!from) continue;
          edges.push(
            orthogonalPath(
              cardLeft(round.roundIndex - 1) + CARD_W,
              from.cy,
              x,
              cy,
            ),
          );
        }
      }
    }

    let thirdNode: { match: BracketMatchView; x: number; y: number } | null =
      null;

    if (board.thirdPlace) {
      const third = board.thirdPlace;
      const allMain = rounds.flatMap((r) => r.matches);
      const feeders = dropFromMatchIds
        .map((id) => allMain.find((m) => m.id === id))
        .filter((m): m is BracketMatchView => m != null);

      const finalRoundIndex = Math.max(0, rounds.length - 1);
      const finalMatch = rounds[finalRoundIndex]?.matches[0];
      const finalNode = finalMatch
        ? nodes.find((n) => n.match.id === finalMatch.id)
        : undefined;
      const anchorBottom = finalNode
        ? finalNode.y + CARD_H
        : nodes.length > 0
          ? Math.max(...nodes.map((n) => n.y + CARD_H))
          : PAD_Y + ROUND_LABEL_H;

      // Place 3rd-place directly under the final (same column), not under the full tree.
      const thirdX = cardLeft(finalRoundIndex);
      const thirdY = anchorBottom + THIRD_GAP;

      thirdNode = { match: third, x: thirdX, y: thirdY };
      nodes.push(thirdNode);

      if (feeders.length > 0) {
        for (const feeder of feeders) {
          const from = centers.get(feeder.id);
          if (!from) continue;
          dashedEdges.push(
            dropPath(from.x + CARD_W / 2, from.bottom, thirdX + CARD_W / 2, thirdY),
          );
        }
      } else {
        dashedEdges.push(
          dropPath(
            cardLeft(Math.max(0, finalRoundIndex - 1)) + CARD_W / 2,
            anchorBottom,
            thirdX + CARD_W / 2,
            thirdY,
          ),
        );
      }
    }

    const width =
      PAD_X * 2 +
      Math.max(rounds.length, 1) * CARD_W +
      Math.max(rounds.length - 1, 0) * COL_GAP;
    const height =
      Math.max(...nodes.map((n) => n.y + CARD_H), PAD_Y + ROUND_LABEL_H) + PAD_Y;

    const columnLabels = rounds.map((r) => ({
      label: localizeRoundLabel(r.label, t),
      x: cardLeft(r.roundIndex),
    }));
    if (thirdNode) {
      columnLabels.push({
        label: t("thirdPlace"),
        x: thirdNode.x,
      });
    }

    return { width, height, edges, dashedEdges, nodes, columnLabels, thirdNode };
  }, [board.rounds, board.thirdPlace, dropFromMatchIds, t]);

  if (!layout) return null;

  // Deduplicate column labels that share the same x (final + 3rd under same col).
  const labelsByX = new Map<number, string[]>();
  for (const col of layout.columnLabels) {
    const list = labelsByX.get(col.x) ?? [];
    if (!list.includes(col.label)) list.push(col.label);
    labelsByX.set(col.x, list);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-700 px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
          {t("knockout")}
        </h3>
        <p className="text-[11px] text-slate-500">{t("mainBracketSubtitle")}</p>
      </header>
      <div className="overflow-x-auto bg-slate-950/50 p-2">
        <div
          className="relative"
          style={{
            width: layout.width,
            height: layout.height,
            minWidth: "100%",
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            aria-hidden
          >
            {layout.edges.map((d, i) => (
              <path
                key={`e-${i}`}
                d={d}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.5}
              />
            ))}
            {layout.dashedEdges.map((d, i) => (
              <path
                key={`d-${i}`}
                d={d}
                fill="none"
                stroke="#f97316"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            ))}
          </svg>

          {[...labelsByX.entries()].map(([x, texts]) => (
            <div
              key={x}
              className="absolute text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
              style={{ left: x, top: PAD_Y, width: CARD_W }}
            >
              {texts[0]}
            </div>
          ))}

          {layout.thirdNode ? (
            <div
              className="absolute text-center text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/80"
              style={{
                left: layout.thirdNode.x,
                top: layout.thirdNode.y - 18,
                width: CARD_W,
              }}
            >
              {t("thirdPlace")}
            </div>
          ) : null}

          {layout.nodes.map(({ match, x, y }) => (
            <AbsoluteCard key={match.id} x={x} y={y}>
              <MatchNodeCard
                match={match}
                href={href(match.id)}
                labels={labels}
                statusLabel={tStatus(match.status)}
                code={matchCode(match)}
              />
            </AbsoluteCard>
          ))}
        </div>
      </div>
    </section>
  );
}
