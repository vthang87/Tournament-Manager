import { describe, expect, it } from "vitest";
import {
  nextPowerOfTwo,
  roundLabelFromStructure,
} from "@/features/bracket/lib/round-labels";
import { buildBracketBoardView } from "@/features/bracket/lib/build-bracket-view";
import type { Entry, MatchRecord, MatchSet } from "@/core/domain";

describe("roundLabelFromStructure", () => {
  it("labels rounds from remaining size, not stage names", () => {
    expect(roundLabelFromStructure(0, 4)).toBe("Round of 16");
    expect(roundLabelFromStructure(1, 4)).toBe("Quarterfinals");
    expect(roundLabelFromStructure(2, 4)).toBe("Semifinals");
    expect(roundLabelFromStructure(3, 4)).toBe("Final");
    expect(
      roundLabelFromStructure(3, 4, { isThirdPlace: true }),
    ).toBe("3rd Place");
  });

  it("works for arbitrary power-of-two brackets", () => {
    expect(roundLabelFromStructure(0, 3)).toBe("Quarterfinals");
    expect(roundLabelFromStructure(0, 5)).toBe("Round of 32");
  });
});

describe("nextPowerOfTwo", () => {
  it("rounds up", () => {
    expect(nextPowerOfTwo(12)).toBe(16);
    expect(nextPowerOfTwo(16)).toBe(16);
    expect(nextPowerOfTwo(1)).toBe(2);
  });
});

describe("buildBracketBoardView", () => {
  it("groups matches by round_number", () => {
    const entries: Entry[] = [
      {
        id: "e1",
        eventId: "ev",
        displayName: "Alpha",
        seed: 1,
        ranking: null,
        clubId: null,
        status: "ACTIVE",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "e2",
        eventId: "ev",
        displayName: "Beta",
        seed: 2,
        ranking: null,
        clubId: null,
        status: "ACTIVE",
        createdAt: "",
        updatedAt: "",
      },
    ];

    const base = {
      eventId: "ev",
      stageId: "st",
      groupId: null,
      entryAId: "e1",
      entryBId: "e2",
      winnerEntryId: null,
      status: "PENDING" as const,
      resolution: null,
      ruleSnapshotJson: "{}",
      generationKey: "k",
      courtId: null,
      scheduledAt: null,
      estimatedDurationMinutes: null,
      startedAt: null,
      completedAt: null,
      nextMatchId: null,
      nextMatchSlot: null,
      loserNextMatchId: null,
      loserNextMatchSlot: null,
      isThirdPlace: false,
      createdAt: "",
      updatedAt: "",
    };

    const matches: MatchRecord[] = [
      { ...base, id: "m1", roundNumber: 0, bracketPosition: 0 },
      { ...base, id: "m2", roundNumber: 0, bracketPosition: 1 },
      {
        ...base,
        id: "m3",
        roundNumber: 1,
        bracketPosition: 0,
        entryAId: null,
        entryBId: null,
      },
    ];

    const setsByMatchId = new Map<string, MatchSet[]>();
    const board = buildBracketBoardView({
      matches,
      setsByMatchId,
      entries,
      groups: [],
      groupEntries: [],
    });

    expect(board).not.toBeNull();
    expect(board!.bracketSize).toBe(4);
    expect(board!.rounds).toHaveLength(2);
    expect(board!.rounds[0]!.label).toBe("Semifinals");
    expect(board!.rounds[1]!.label).toBe("Final");
    expect(board!.rounds[0]!.matches[0]!.slotA.displayName).toBe("Alpha");
  });
});
