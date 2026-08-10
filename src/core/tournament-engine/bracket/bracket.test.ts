import { describe, expect, it } from "vitest";
import type { Qualifier } from "@/core/tournament-engine/qualification";
import {
  advanceWinner,
  generateBracket,
  seedingOrder,
} from "@/core/tournament-engine/bracket";

function makeQualifiers(count: number): Qualifier[] {
  return Array.from({ length: count }, (_, index) => ({
    entryId: `E${index + 1}`,
    sourceGroupId: `G${(index % 8) + 1}`,
    sourceRank: index < 8 ? 1 : 2,
    qualificationSeed: index + 1,
    isAdditional: false,
  }));
}

describe("seedingOrder", () => {
  it("builds classic 4 and 8 seed layouts", () => {
    expect(seedingOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedingOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("generateBracket", () => {
  it("places 16 qualifiers into a 16 bracket", () => {
    const result = generateBracket({
      qualifiers: makeQualifiers(16),
      bracketSize: 16,
      placementRule: "BY_QUALIFICATION_SEED",
    });

    expect(result.data.bracketSize).toBe(16);
    const r1 = result.data.matches.filter((m) => m.roundIndex === 0);
    expect(r1).toHaveLength(8);
    expect(r1.every((m) => m.slotA.entryId && m.slotB.entryId)).toBe(true);
    expect(r1.every((m) => !m.slotA.isBye && !m.slotB.isBye)).toBe(true);
  });

  it("creates 4 BYEs for 12 qualifiers in a 16 bracket and auto-advances", () => {
    const result = generateBracket({
      qualifiers: makeQualifiers(12),
      bracketSize: 16,
      placementRule: "BY_QUALIFICATION_SEED",
      byeAssignment: "TOP_SEEDS",
    });

    const r1 = result.data.matches.filter(
      (m) => m.roundIndex === 0 && !m.isThirdPlace,
    );
    const byeSlots = r1.flatMap((m) => [m.slotA, m.slotB]).filter((s) => s.isBye);
    expect(byeSlots).toHaveLength(4);

    // Auto-advance: R1 matches with a BYE should already have a winner.
    const byeMatches = r1.filter((m) => m.slotA.isBye || m.slotB.isBye);
    expect(byeMatches.every((m) => m.winnerEntryId != null)).toBe(true);

    // Winners appear in R2 slots.
    for (const match of byeMatches) {
      const next = result.data.matches.find((m) => m.id === match.nextMatchId)!;
      const slot =
        match.nextMatchSlot === "A" ? next.slotA.entryId : next.slotB.entryId;
      expect(slot).toBe(match.winnerEntryId);
    }
  });

  it("wires nextMatchSlot and supports third-place loser slots", () => {
    const result = generateBracket({
      qualifiers: makeQualifiers(4),
      bracketSize: 4,
      placementRule: "BY_QUALIFICATION_SEED",
      thirdPlaceEnabled: true,
    });

    expect(result.data.matches.some((m) => m.isThirdPlace)).toBe(true);
    const sf = result.data.matches.filter((m) => m.roundIndex === 0);
    expect(sf).toHaveLength(2);
    expect(sf.every((m) => m.loserNextMatchId === "TP-M0")).toBe(true);
    expect(sf.map((m) => m.loserNextMatchSlot).sort()).toEqual(["A", "B"]);
  });

  it("warns when same-group R1 cannot be avoided", () => {
    const qualifiers: Qualifier[] = [
      {
        entryId: "A1",
        sourceGroupId: "G1",
        sourceRank: 1,
        qualificationSeed: 1,
        isAdditional: false,
      },
      {
        entryId: "A2",
        sourceGroupId: "G1",
        sourceRank: 2,
        qualificationSeed: 2,
        isAdditional: false,
      },
    ];

    const result = generateBracket({
      qualifiers,
      bracketSize: 2,
      placementRule: "BY_QUALIFICATION_SEED",
      avoidSameGroupRoundOne: true,
    });

    expect(
      result.warnings.some((w) => w.code === "BRACKET_SAME_GROUP_R1"),
    ).toBe(true);
  });
});

describe("advanceWinner", () => {
  it("advances winner into the next slot and is idempotent on retry", () => {
    const { data: bracket } = generateBracket({
      qualifiers: makeQualifiers(4),
      bracketSize: 4,
      placementRule: "BY_QUALIFICATION_SEED",
      thirdPlaceEnabled: true,
    });

    const r1 = bracket.matches.find((m) => m.id === "R0-M0")!;
    const winner = r1.slotA.entryId!;
    const loser = r1.slotB.entryId!;

    const first = advanceWinner({
      bracket,
      completedMatch: { matchId: "R0-M0", winnerEntryId: winner },
    });

    const final = first.bracket.matches.find((m) => m.id === "R1-M0")!;
    expect(final.slotA.entryId).toBe(winner);

    const second = advanceWinner({
      bracket: first.bracket,
      completedMatch: { matchId: "R0-M0", winnerEntryId: winner },
    });
    expect(
      second.bracket.matches.find((m) => m.id === "R1-M0")!.slotA.entryId,
    ).toBe(winner);

    // Complete other SF → losers go to third place.
    const r1b = second.bracket.matches.find((m) => m.id === "R0-M1")!;
    const w2 = r1b.slotA.entryId!;
    const afterSf = advanceWinner({
      bracket: second.bracket,
      completedMatch: { matchId: "R0-M1", winnerEntryId: w2 },
    });

    const tp = afterSf.bracket.matches.find((m) => m.isThirdPlace)!;
    expect([tp.slotA.entryId, tp.slotB.entryId].sort()).toEqual(
      [loser, r1b.slotB.entryId].sort(),
    );
  });
});
