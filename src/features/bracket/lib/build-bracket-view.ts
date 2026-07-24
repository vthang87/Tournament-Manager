import type { Entry, MatchRecord, MatchSet, TournamentGroup } from "@/core/domain";
import type { Qualifier } from "@/core/tournament-engine/qualification/types";
import { formatSetScore, roundLabelFromStructure } from "./round-labels";

export type BracketSlotView = {
  entryId: string | null;
  displayName: string | null;
  entrySeed: number | null;
  groupCode: string | null;
  qualificationSeed: number | null;
  sourceRank: number | null;
  isBye: boolean;
};

export type BracketMatchView = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  roundLabel: string;
  status: MatchRecord["status"];
  scoreText: string | null;
  isThirdPlace: boolean;
  slotA: BracketSlotView;
  slotB: BracketSlotView;
  winnerEntryId: string | null;
  nextMatchId: string | null;
};

export type BracketRoundView = {
  roundIndex: number;
  label: string;
  matches: BracketMatchView[];
};

export type BracketBoardView = {
  bracketSize: number;
  roundCount: number;
  rounds: BracketRoundView[];
  thirdPlace: BracketMatchView | null;
};

function slotView(
  entryId: string | null,
  isBye: boolean,
  entriesById: Map<string, Entry>,
  groupByEntryId: Map<string, TournamentGroup>,
  qualifierByEntryId: Map<string, Qualifier>,
): BracketSlotView {
  if (isBye && entryId == null) {
    return {
      entryId: null,
      displayName: "BYE",
      entrySeed: null,
      groupCode: null,
      qualificationSeed: null,
      sourceRank: null,
      isBye: true,
    };
  }
  const entry = entryId ? entriesById.get(entryId) : undefined;
  const group = entryId ? groupByEntryId.get(entryId) : undefined;
  const qualifier = entryId ? qualifierByEntryId.get(entryId) : undefined;
  return {
    entryId,
    displayName: entry?.displayName ?? (entryId ? "TBD" : "TBD"),
    entrySeed: entry?.seed ?? null,
    groupCode: group?.code ?? null,
    qualificationSeed: qualifier?.qualificationSeed ?? null,
    sourceRank: qualifier?.sourceRank ?? null,
    isBye: false,
  };
}

function isSlotBye(match: MatchRecord, side: "A" | "B"): boolean {
  const entryId = side === "A" ? match.entryAId : match.entryBId;
  if (entryId != null) return false;
  // BYE auto-advance: winner set and this side empty
  if (match.winnerEntryId != null && entryId == null) {
    const other = side === "A" ? match.entryBId : match.entryAId;
    return other != null && other === match.winnerEntryId;
  }
  return false;
}

export function buildBracketBoardView(input: {
  matches: MatchRecord[];
  setsByMatchId: Map<string, MatchSet[]>;
  entries: Entry[];
  groups: TournamentGroup[];
  groupEntries: Array<{ groupId: string; entryId: string }>;
  qualifiers?: Qualifier[];
}): BracketBoardView | null {
  const main = input.matches.filter((m) => !m.isThirdPlace);
  const third = input.matches.find((m) => m.isThirdPlace) ?? null;
  if (main.length === 0 && !third) {
    return null;
  }

  const entriesById = new Map(input.entries.map((e) => [e.id, e]));
  const groupsById = new Map(input.groups.map((g) => [g.id, g]));
  const groupByEntryId = new Map<string, TournamentGroup>();
  for (const ge of input.groupEntries) {
    const g = groupsById.get(ge.groupId);
    if (g) groupByEntryId.set(ge.entryId, g);
  }
  const qualifierByEntryId = new Map(
    (input.qualifiers ?? []).map((q) => [q.entryId, q]),
  );

  const roundCount =
    Math.max(0, ...main.map((m) => m.roundNumber)) + (main.length > 0 ? 1 : 1);
  const r1 = main.filter((m) => m.roundNumber === 0);
  const bracketSize = Math.max(2, r1.length * 2);

  const toView = (m: MatchRecord): BracketMatchView => {
    const sets = input.setsByMatchId.get(m.id) ?? [];
    return {
      id: m.id,
      roundIndex: m.roundNumber,
      matchIndex: m.bracketPosition ?? 0,
      roundLabel: roundLabelFromStructure(m.roundNumber, roundCount, {
        isThirdPlace: m.isThirdPlace,
      }),
      status: m.status,
      scoreText: formatSetScore(sets),
      isThirdPlace: m.isThirdPlace,
      slotA: slotView(
        m.entryAId,
        isSlotBye(m, "A"),
        entriesById,
        groupByEntryId,
        qualifierByEntryId,
      ),
      slotB: slotView(
        m.entryBId,
        isSlotBye(m, "B"),
        entriesById,
        groupByEntryId,
        qualifierByEntryId,
      ),
      winnerEntryId: m.winnerEntryId,
      nextMatchId: m.nextMatchId,
    };
  };

  const byRound = new Map<number, BracketMatchView[]>();
  for (const m of main) {
    const list = byRound.get(m.roundNumber) ?? [];
    list.push(toView(m));
    byRound.set(m.roundNumber, list);
  }

  const rounds: BracketRoundView[] = [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundIndex, matches]) => ({
      roundIndex,
      label: roundLabelFromStructure(roundIndex, roundCount),
      matches: matches.sort((a, b) => a.matchIndex - b.matchIndex),
    }));

  return {
    bracketSize,
    roundCount,
    rounds,
    thirdPlace: third ? toView(third) : null,
  };
}
