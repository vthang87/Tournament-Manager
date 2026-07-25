import { describe, expect, it } from "vitest";
import { DomainError } from "@/core/tournament-engine/errors";
import type { StandingRow } from "@/core/tournament-engine/standings";
import {
  QualificationErrorCode,
  resolveQualification,
} from "@/core/tournament-engine/qualification";

function row(
  entryId: string,
  rank: number,
  wins: number,
  setDifference = 0,
  pointDifference = 0,
): StandingRow {
  return {
    entryId,
    rank,
    played: wins,
    wins,
    losses: 0,
    setsWon: wins,
    setsLost: 0,
    setDifference,
    pointsWon: 21 * wins,
    pointsLost: 0,
    pointDifference,
    tieBreakTrace: [],
  };
}

describe("resolveQualification", () => {
  it("takes top 2 from 8 equal groups → 16 qualifiers", () => {
    const standingsByGroup = Array.from({ length: 8 }, (_, index) => {
      const groupId = `G${index + 1}`;
      return {
        groupId,
        standings: [
          row(`${groupId}-1`, 1, 3, 3, 30 - index),
          row(`${groupId}-2`, 2, 2, 1, 10 - index),
          row(`${groupId}-3`, 3, 1, -1, -10),
          row(`${groupId}-4`, 4, 0, -3, -30),
        ],
      };
    });

    const result = resolveQualification({
      standingsByGroup,
      rule: { topPerGroup: 2, bestAdditionalEntries: 0 },
    });

    expect(result.qualifiers).toHaveLength(16);
    expect(result.qualifiers.every((q) => !q.isAdditional)).toBe(true);
    expect(result.qualifiers.filter((q) => q.sourceRank === 1)).toHaveLength(8);
    expect(result.qualifiers.filter((q) => q.sourceRank === 2)).toHaveLength(8);
  });

  it("selects best thirds when group sizes match", () => {
    const standingsByGroup = Array.from({ length: 4 }, (_, index) => {
      const groupId = `G${index + 1}`;
      return {
        groupId,
        standings: [
          row(`${groupId}-1`, 1, 3),
          row(`${groupId}-2`, 2, 2),
          row(`${groupId}-3`, 3, 1, 0, 40 - index * 5),
          row(`${groupId}-4`, 4, 0),
        ],
      };
    });

    const result = resolveQualification({
      standingsByGroup,
      rule: { topPerGroup: 2, bestAdditionalEntries: 2 },
    });

    expect(result.qualifiers).toHaveLength(10);
    const additional = result.qualifiers.filter((q) => q.isAdditional);
    expect(additional).toHaveLength(2);
    expect(additional.map((q) => q.entryId)).toEqual(["G1-3", "G2-3"]);
  });

  it("throws when best-additional is requested with uneven group sizes", () => {
    expect(() =>
      resolveQualification({
        standingsByGroup: [
          {
            groupId: "G1",
            standings: [row("A", 1, 1), row("B", 2, 0), row("C", 3, 0)],
          },
          {
            groupId: "G2",
            standings: [row("D", 1, 1), row("E", 2, 0)],
          },
        ],
        rule: { topPerGroup: 1, bestAdditionalEntries: 1 },
      }),
    ).toThrow(DomainError);

    try {
      resolveQualification({
        standingsByGroup: [
          {
            groupId: "G1",
            standings: [row("A", 1, 1), row("B", 2, 0), row("C", 3, 0)],
          },
          {
            groupId: "G2",
            standings: [row("D", 1, 1), row("E", 2, 0)],
          },
        ],
        rule: { topPerGroup: 1, bestAdditionalEntries: 1 },
      });
    } catch (error) {
      expect((error as DomainError).code).toBe(
        QualificationErrorCode.UNEVEN_GROUP_SIZES,
      );
    }
  });
});
