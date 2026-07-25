import { describe, expect, it } from "vitest";
import { DomainError } from "@/core/tournament-engine/errors";
import {
  DrawErrorCode,
  generateDraw,
  seedRankToGroupIndex,
  validateManualDraw,
  type DrawEntry,
  type DrawGroup,
} from "@/core/tournament-engine/draw";

function makeGroups(count: number, capacity: number): DrawGroup[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `G${index + 1}`,
    name: `Group ${String.fromCharCode(65 + index)}`,
    capacity,
  }));
}

function makeEntries(count: number, seedCount = 0): DrawEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `E${String(index + 1).padStart(2, "0")}`;
    const seed = index < seedCount ? index + 1 : null;
    return {
      id,
      seed,
      clubId: `CLUB-${(index % 8) + 1}`,
    };
  });
}

describe("seedRankToGroupIndex", () => {
  it("maps normal distribution", () => {
    expect(seedRankToGroupIndex(0, 8, "NORMAL")).toBe(0);
    expect(seedRankToGroupIndex(7, 8, "NORMAL")).toBe(7);
    expect(seedRankToGroupIndex(8, 8, "NORMAL")).toBe(0);
  });

  it("maps serpentine distribution", () => {
    // Pass 1 L→R: 0..3
    expect(seedRankToGroupIndex(0, 4, "SERPENTINE")).toBe(0);
    expect(seedRankToGroupIndex(3, 4, "SERPENTINE")).toBe(3);
    // Pass 2 R→L: 3..0  (seeds 5–8 → ranks 4–7)
    expect(seedRankToGroupIndex(4, 4, "SERPENTINE")).toBe(3);
    expect(seedRankToGroupIndex(5, 4, "SERPENTINE")).toBe(2);
    expect(seedRankToGroupIndex(6, 4, "SERPENTINE")).toBe(1);
    expect(seedRankToGroupIndex(7, 4, "SERPENTINE")).toBe(0);
    // Pass 3 L→R
    expect(seedRankToGroupIndex(8, 4, "SERPENTINE")).toBe(0);
  });
});

describe("generateDraw", () => {
  it("places 32 entries into 8×4 groups uniquely", () => {
    const result = generateDraw({
      entries: makeEntries(32, 8),
      groups: makeGroups(8, 4),
      configuration: {
        seedDistribution: "NORMAL",
        avoidSameClub: true,
      },
      randomSeed: "DRAW-2026-TEST",
    });

    expect(result.data.allocations).toHaveLength(32);
    expect(result.data.byGroup).toHaveLength(8);

    const entryIds = result.data.allocations.map((row) => row.entryId);
    expect(new Set(entryIds).size).toBe(32);

    for (const group of result.data.byGroup) {
      expect(group.entryIds).toHaveLength(4);
    }
  });

  it("distributes 8 seeds one per group under NORMAL", () => {
    const entries = makeEntries(32, 8);
    const groups = makeGroups(8, 4);
    const result = generateDraw({
      entries,
      groups,
      configuration: { seedDistribution: "NORMAL", avoidSameClub: false },
      randomSeed: 42,
    });

    for (let seed = 1; seed <= 8; seed += 1) {
      const entry = entries.find((row) => row.seed === seed)!;
      const allocation = result.data.allocations.find(
        (row) => row.entryId === entry.id,
      )!;
      expect(allocation.groupId).toBe(groups[seed - 1]!.id);
    }
  });

  it("uses serpentine when seeds exceed group count", () => {
    const entries = makeEntries(16, 12);
    const groups = makeGroups(4, 4);
    const result = generateDraw({
      entries,
      groups,
      configuration: { seedDistribution: "SERPENTINE", avoidSameClub: false },
      randomSeed: 7,
    });

    // ranks 0–3 → G1–G4; ranks 4–7 → G4–G1; ranks 8–11 → G1–G4
    const expected = [
      "G1",
      "G2",
      "G3",
      "G4",
      "G4",
      "G3",
      "G2",
      "G1",
      "G1",
      "G2",
      "G3",
      "G4",
    ];

    for (let seed = 1; seed <= 12; seed += 1) {
      const entry = entries.find((row) => row.seed === seed)!;
      const allocation = result.data.allocations.find(
        (row) => row.entryId === entry.id,
      )!;
      expect(allocation.groupId).toBe(expected[seed - 1]);
    }
  });

  it("is deterministic for the same random seed", () => {
    const input = {
      entries: makeEntries(32, 8),
      groups: makeGroups(8, 4),
      configuration: {
        seedDistribution: "NORMAL" as const,
        avoidSameClub: true,
      },
      randomSeed: "same-seed",
    };

    const a = generateDraw(input);
    const b = generateDraw(input);
    expect(a.data.allocations).toEqual(b.data.allocations);
    expect(a.warnings).toEqual(b.warnings);
  });

  it("can produce different allocations for different seeds", () => {
    const base = {
      entries: makeEntries(32, 0),
      groups: makeGroups(8, 4),
      configuration: {
        seedDistribution: "NORMAL" as const,
        avoidSameClub: false,
      },
    };

    const a = generateDraw({ ...base, randomSeed: 1 });
    const b = generateDraw({ ...base, randomSeed: 2 });

    const key = (rows: typeof a.data.allocations) =>
      rows
        .map((row) => `${row.entryId}:${row.groupId}`)
        .sort()
        .join("|");

    expect(key(a.data.allocations)).not.toEqual(key(b.data.allocations));
  });

  it("avoids same-club when a feasible allocation exists", () => {
    // 4 groups × 2; two clubs with 2 each — should separate.
    const entries: DrawEntry[] = [
      { id: "A1", clubId: "X" },
      { id: "A2", clubId: "X" },
      { id: "B1", clubId: "Y" },
      { id: "B2", clubId: "Y" },
      { id: "C1", clubId: "Z" },
      { id: "C2", clubId: "Z" },
      { id: "D1", clubId: "W" },
      { id: "D2", clubId: "W" },
    ];
    const groups = makeGroups(4, 2);

    const result = generateDraw({
      entries,
      groups,
      configuration: { seedDistribution: "NORMAL", avoidSameClub: true },
      randomSeed: 99,
    });

    for (const group of result.data.byGroup) {
      const clubs = group.entryIds.map(
        (id) => entries.find((entry) => entry.id === id)!.clubId,
      );
      expect(new Set(clubs).size).toBe(clubs.length);
    }
    expect(result.warnings.filter((w) => w.code === "DRAW_SAME_CLUB")).toHaveLength(
      0,
    );
  });

  it("emits warning when same-club is impossible to avoid", () => {
    // One group capacity 3, only one group — three from same club must cohabit.
    const entries: DrawEntry[] = [
      { id: "A", clubId: "SAME" },
      { id: "B", clubId: "SAME" },
      { id: "C", clubId: "SAME" },
    ];
    const groups: DrawGroup[] = [{ id: "G1", capacity: 3 }];

    const result = generateDraw({
      entries,
      groups,
      configuration: { seedDistribution: "NORMAL", avoidSameClub: true },
      randomSeed: 1,
    });

    expect(result.data.allocations).toHaveLength(3);
    expect(
      result.warnings.some((warning) => warning.code === "DRAW_SAME_CLUB"),
    ).toBe(true);
  });

  it("throws on insufficient capacity", () => {
    expect(() =>
      generateDraw({
        entries: makeEntries(5),
        groups: makeGroups(2, 2),
        configuration: { seedDistribution: "NORMAL", avoidSameClub: false },
        randomSeed: 1,
      }),
    ).toThrow(DomainError);

    try {
      generateDraw({
        entries: makeEntries(5),
        groups: makeGroups(2, 2),
        configuration: { seedDistribution: "NORMAL", avoidSameClub: false },
        randomSeed: 1,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(
        DrawErrorCode.INSUFFICIENT_CAPACITY,
      );
    }
  });
});

describe("validateManualDraw", () => {
  it("accepts a valid allocation", () => {
    const entries = makeEntries(4, 0);
    const groups = makeGroups(2, 2);
    const result = validateManualDraw({
      allocation: [
        { groupId: "G1", entryId: "E01" },
        { groupId: "G1", entryId: "E02" },
        { groupId: "G2", entryId: "E03" },
        { groupId: "G2", entryId: "E04" },
      ],
      entries,
      groups,
      configuration: { seedDistribution: "NORMAL", avoidSameClub: false },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects capacity overflow and duplicates", () => {
    const entries = makeEntries(3, 0);
    const groups = makeGroups(1, 2);
    const result = validateManualDraw({
      allocation: [
        { groupId: "G1", entryId: "E01" },
        { groupId: "G1", entryId: "E02" },
        { groupId: "G1", entryId: "E03" },
        { groupId: "G1", entryId: "E01" },
      ],
      entries,
      groups,
      configuration: { seedDistribution: "NORMAL", avoidSameClub: false },
    });
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === DrawErrorCode.CAPACITY_EXCEEDED),
    ).toBe(true);
    expect(
      result.issues.some((issue) => issue.code === DrawErrorCode.DUPLICATE_ENTRY),
    ).toBe(true);
  });

  it("warns on same-club soft violation without invalidating", () => {
    const entries: DrawEntry[] = [
      { id: "A", clubId: "X" },
      { id: "B", clubId: "X" },
    ];
    const groups: DrawGroup[] = [{ id: "G1", capacity: 2 }];
    const result = validateManualDraw({
      allocation: [
        { groupId: "G1", entryId: "A" },
        { groupId: "G1", entryId: "B" },
      ],
      entries,
      groups,
      configuration: { seedDistribution: "NORMAL", avoidSameClub: true },
    });
    expect(result.valid).toBe(true);
    expect(
      result.issues.some(
        (issue) =>
          issue.severity === "warning" && issue.code === "DRAW_SAME_CLUB",
      ),
    ).toBe(true);
  });
});
