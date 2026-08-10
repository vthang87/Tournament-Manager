import { describe, expect, it } from "vitest";
import {
  generateRoundRobin,
  type RoundRobinRound,
} from "@/core/tournament-engine/round-robin";

function allPairs(rounds: RoundRobinRound[]): string[] {
  return rounds.flatMap((round) =>
    round.pairs.map((pair) => `${pair.entryAId}|${pair.entryBId}`),
  );
}

function assertRoundRobinInvariants(entryIds: string[], rounds: RoundRobinRound[]) {
  const n = entryIds.length;
  const expectedMatches = (n * (n - 1)) / 2;

  const pairs = allPairs(rounds);
  expect(pairs).toHaveLength(expectedMatches);
  expect(new Set(pairs).size).toBe(expectedMatches);

  // Every unordered pair exactly once.
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = entryIds[i]!;
      const b = entryIds[j]!;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      expect(pairs).toContain(key);
    }
  }

  // No entry twice in a round; no BYE pairs.
  for (const round of rounds) {
    const seen = new Set<string>();
    for (const pair of round.pairs) {
      expect(pair.entryAId).not.toBe("BYE");
      expect(pair.entryBId).not.toBe("BYE");
      expect(seen.has(pair.entryAId)).toBe(false);
      expect(seen.has(pair.entryBId)).toBe(false);
      seen.add(pair.entryAId);
      seen.add(pair.entryBId);
    }
  }
}

describe("generateRoundRobin", () => {
  it.each([3, 4, 5, 6, 7, 8])("supports %i entries", (count) => {
    const entryIds = Array.from({ length: count }, (_, i) => `E${i + 1}`);
    const rounds = generateRoundRobin({ entryIds });
    assertRoundRobinInvariants(entryIds, rounds);
  });

  it("is deterministic for the same entry order", () => {
    const entryIds = ["A", "B", "C", "D"];
    expect(generateRoundRobin({ entryIds })).toEqual(
      generateRoundRobin({ entryIds }),
    );
  });

  it("uses internal BYE for odd counts without emitting BYE matches", () => {
    const rounds = generateRoundRobin({ entryIds: ["A", "B", "C"] });
    const flat = allPairs(rounds).join(",");
    expect(flat.includes("BYE")).toBe(false);
    expect(rounds).toHaveLength(3); // with bye: (3+1)-1 = 3 rounds
    // Each round has one real match (one bye).
    for (const round of rounds) {
      expect(round.pairs).toHaveLength(1);
    }
  });
});
