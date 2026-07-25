import type {
  Entry,
  MatchRecord,
  MatchSet,
  Stage,
  TournamentGroup,
} from "@/core/domain";
import { roundLabelFromStructure } from "@/features/bracket/lib/round-labels";
import type { OrgChartNode } from "./types";

function matchLabel(
  match: MatchRecord,
  entriesById: Map<string, Entry>,
  roundCount: number,
  tbd: string,
  vs: string,
): { label: string; sublabel: string } {
  const a = match.entryAId
    ? (entriesById.get(match.entryAId)?.displayName ?? tbd)
    : tbd;
  const b = match.entryBId
    ? (entriesById.get(match.entryBId)?.displayName ?? tbd)
    : tbd;
  const roundTag = roundLabelFromStructure(match.roundNumber, roundCount, {
    isThirdPlace: match.isThirdPlace,
  });
  return {
    label: `${a} ${vs} ${b}`,
    sublabel: `${roundTag} · M${(match.bracketPosition ?? 0) + 1}`,
  };
}

/**
 * Build knockout match org-chart forest.
 * Roots = matches with no nextMatchId (final + third place).
 * Children = earlier matches that feed into a parent via nextMatchId / loserNextMatchId.
 */
export function buildMatchOrgRoots(input: {
  matches: MatchRecord[];
  setsByMatchId: Map<string, MatchSet[]>;
  entries: Entry[];
  tournamentId: string;
  eventId: string;
  labels: { tbd: string; vs: string; bye: string; thirdPlace: string };
}): OrgChartNode[] {
  const { matches, setsByMatchId, entries, tournamentId, eventId, labels } =
    input;
  if (matches.length === 0) return [];

  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const byId = new Map(matches.map((m) => [m.id, m]));
  const mainRounds = matches.filter((m) => !m.isThirdPlace);
  const roundCount =
    mainRounds.length === 0
      ? 1
      : Math.max(...mainRounds.map((m) => m.roundNumber)) + 1;

  /** parentId → child match ids that advance winners into parent. */
  const childrenOf = new Map<string, string[]>();
  /** third-place (or other) parent ← loser feeders. */
  const loserFeedersOf = new Map<string, string[]>();
  for (const m of matches) {
    if (m.nextMatchId && byId.has(m.nextMatchId)) {
      const list = childrenOf.get(m.nextMatchId) ?? [];
      list.push(m.id);
      childrenOf.set(m.nextMatchId, list);
    }
    if (m.loserNextMatchId && byId.has(m.loserNextMatchId)) {
      const list = loserFeedersOf.get(m.loserNextMatchId) ?? [];
      list.push(m.id);
      loserFeedersOf.set(m.loserNextMatchId, list);
    }
  }

  function sortFeeders(ids: string[]): string[] {
    return [...new Set(ids)].sort((a, b) => {
      const ma = byId.get(a)!;
      const mb = byId.get(b)!;
      if (ma.roundNumber !== mb.roundNumber) {
        return ma.roundNumber - mb.roundNumber;
      }
      return (ma.bracketPosition ?? 0) - (mb.bracketPosition ?? 0);
    });
  }

  function leafFromMatch(matchId: string): OrgChartNode | null {
    const match = byId.get(matchId);
    if (!match) return null;
    const parts = matchLabel(
      match,
      entriesById,
      roundCount,
      labels.tbd,
      labels.vs,
    );
    return {
      id: `feeder-${match.id}`,
      label: parts.label,
      sublabel: `${parts.sublabel} →`,
      status: match.status,
      tone: "muted",
      href: `/admin/tournaments/${tournamentId}/events/${eventId}/matches/${match.id}`,
    };
  }

  function toNode(matchId: string, seen: Set<string>): OrgChartNode | null {
    if (seen.has(matchId)) return null;
    seen.add(matchId);
    const match = byId.get(matchId);
    if (!match) return null;

    const parts = matchLabel(
      match,
      entriesById,
      roundCount,
      labels.tbd,
      labels.vs,
    );
    const sets = setsByMatchId.get(match.id) ?? [];
    const score =
      sets.length > 0
        ? sets.map((s) => `${s.scoreA}–${s.scoreB}`).join(", ")
        : undefined;

    const winnerFeeders = sortFeeders(childrenOf.get(match.id) ?? []);
    const children = winnerFeeders
      .map((id) => toNode(id, seen))
      .filter((n): n is OrgChartNode => n != null);

    // Third-place (etc.): show loser feeders as leaf stubs, not full subtrees.
    if (match.isThirdPlace || (!match.nextMatchId && winnerFeeders.length === 0)) {
      for (const id of sortFeeders(loserFeedersOf.get(match.id) ?? [])) {
        const leaf = leafFromMatch(id);
        if (leaf) children.push(leaf);
      }
    }

    return {
      id: match.id,
      label: match.isThirdPlace
        ? `${labels.thirdPlace}: ${parts.label}`
        : parts.label,
      sublabel: parts.sublabel,
      meta: score,
      status: match.status,
      tone: "match",
      href: `/admin/tournaments/${tournamentId}/events/${eventId}/matches/${match.id}`,
      children: children.length > 0 ? children : undefined,
    };
  }

  const roots = matches
    .filter((m) => !m.nextMatchId)
    .sort((a, b) => {
      if (a.isThirdPlace !== b.isThirdPlace) {
        return a.isThirdPlace ? 1 : -1;
      }
      return (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0);
    });

  const seen = new Set<string>();
  return roots
    .map((m) => toNode(m.id, seen))
    .filter((n): n is OrgChartNode => n != null);
}

export function buildGroupStageSummaryNode(input: {
  stage: Stage;
  groups: TournamentGroup[];
  matches: MatchRecord[];
  tournamentId: string;
  eventId: string;
  labels: {
    groupStage: string;
    group: string;
    matchesCount: (done: number, total: number) => string;
  };
}): OrgChartNode {
  const { stage, groups, matches, tournamentId, eventId, labels } = input;
  const byGroup = new Map<string, MatchRecord[]>();
  for (const m of matches) {
    if (!m.groupId) continue;
    const list = byGroup.get(m.groupId) ?? [];
    list.push(m);
    byGroup.set(m.groupId, list);
  }

  const sortedGroups = [...groups].sort((a, b) =>
    (a.code ?? a.name).localeCompare(b.code ?? b.name),
  );

  return {
    id: `stage-${stage.id}`,
    label: labels.groupStage,
    status: stage.status,
    tone: "stage",
    href: `/admin/tournaments/${tournamentId}/events/${eventId}/groups`,
    children: sortedGroups.map((g) => {
      const gm = byGroup.get(g.id) ?? [];
      const done = gm.filter(
        (m) =>
          m.status === "COMPLETED" ||
          m.status === "WALKOVER" ||
          m.status === "CANCELLED",
      ).length;
      return {
        id: `group-${g.id}`,
        label: g.name || `${labels.group} ${g.code}`,
        sublabel: labels.matchesCount(done, gm.length),
        status: done === gm.length && gm.length > 0 ? "COMPLETED" : stage.status,
        tone: "group" as const,
        href: `/admin/tournaments/${tournamentId}/events/${eventId}/groups`,
      };
    }),
  };
}
