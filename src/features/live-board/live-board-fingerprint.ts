import type { LiveBoardSnapshot } from "@/application/services/dashboard-service";

/** Stable fingerprint so SSE only pushes when board content changes. */
export function liveBoardFingerprint(board: LiveBoardSnapshot): string {
  const live = board.inProgress
    .map(
      (m) =>
        [
          m.matchId,
          m.status,
          m.startedAt ?? "",
          m.scoreSummary,
          m.courtId ?? "",
          m.entryAName ?? "",
          m.entryBName ?? "",
          m.entryAClub ?? "",
          m.entryBClub ?? "",
        ].join(":"),
    )
    .join("|");
  const preparing = board.preparing
    .map((m) =>
      [
        m.matchId,
        m.warmupUntil,
        m.entryAName ?? "",
        m.entryBName ?? "",
        m.courtCode ?? "",
      ].join(":"),
    )
    .join("|");
  const upcoming = board.upcoming
    .slice(0, 8)
    .map((m) =>
      [
        m.matchId,
        m.scheduledAt ?? "",
        m.courtCode ?? "",
        m.status,
        m.entryAName ?? "",
        m.entryBName ?? "",
        m.entryAClub ?? "",
        m.entryBClub ?? "",
      ].join(":"),
    )
    .join("|");
  const results = board.recentResults
    .map((m) =>
      [
        m.matchId,
        m.scoreSummary,
        m.sets.map((s) => `${s.scoreA}-${s.scoreB}`).join(","),
        m.winnerEntryId ?? "",
        m.winnerName ?? "",
        m.entryAClub ?? "",
        m.entryBClub ?? "",
        m.completedAt ?? "",
        m.resolution ?? "",
      ].join(":"),
    )
    .join("|");
  return `${board.tournamentId}#${live}#${preparing}#${upcoming}#${results}`;
}
