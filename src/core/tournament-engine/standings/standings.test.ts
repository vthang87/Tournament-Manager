import { describe, expect, it } from "vitest";
import {
  calculateStandings,
  defaultStandingRule,
  DEFAULT_SPECIAL_POLICY,
  type StandingMatch,
} from "@/core/tournament-engine/standings";

const entries = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];

function normalMatch(
  id: string,
  entryAId: string,
  entryBId: string,
  sets: Array<[number, number]>,
): StandingMatch {
  let setsWonA = 0;
  let setsWonB = 0;
  for (const [a, b] of sets) {
    if (a > b) setsWonA += 1;
    else setsWonB += 1;
  }
  return {
    id,
    entryAId,
    entryBId,
    winnerEntryId: setsWonA > setsWonB ? entryAId : entryBId,
    resolution: "NORMAL",
    sets: sets.map(([scoreA, scoreB]) => ({ scoreA, scoreB })),
  };
}

describe("calculateStandings", () => {
  it("returns zeroed rows when there are no matches", () => {
    const rows = calculateStandings({
      entries,
      matches: [],
      rule: defaultStandingRule(),
    });
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.played === 0 && row.wins === 0)).toBe(true);
    // ENTRY_ID fallback ranks alphabetically with shared rank progression.
    expect(rows.map((row) => row.entryId)).toEqual(["A", "B", "C", "D"]);
  });

  it("aggregates partial completed matches", () => {
    const rows = calculateStandings({
      entries,
      matches: [
        normalMatch("m1", "A", "B", [[21, 15]]),
        {
          id: "m2",
          entryAId: "C",
          entryBId: "D",
          winnerEntryId: null,
          sets: [],
        },
      ],
      rule: defaultStandingRule(),
    });

    const byId = Object.fromEntries(rows.map((row) => [row.entryId, row]));
    expect(byId.A!.wins).toBe(1);
    expect(byId.B!.losses).toBe(1);
    expect(byId.C!.played).toBe(0);
    expect(byId.A!.rank).toBe(1);
  });

  it("uses head-to-head for a 2-way tie", () => {
    // A and B both 2 wins; A beat B directly.
    // A: beat B, beat D, lost to C
    // B: beat C, beat D, lost to A
    const matches = [
      normalMatch("ab", "A", "B", [[21, 19]]),
      normalMatch("ac", "A", "C", [[10, 21]]),
      normalMatch("ad", "A", "D", [[21, 10]]),
      normalMatch("bc", "B", "C", [[21, 10]]),
      normalMatch("bd", "B", "D", [[21, 10]]),
    ];

    const rows = calculateStandings({
      entries: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
      matches,
      rule: defaultStandingRule(),
    });

    expect(rows.find((row) => row.entryId === "A")!.wins).toBe(2);
    expect(rows.find((row) => row.entryId === "B")!.wins).toBe(2);
    expect(rows[0]!.entryId).toBe("A");
    expect(rows[1]!.entryId).toBe("B");
    expect(
      rows[0]!.tieBreakTrace.some((step) => step.criterion === "HEAD_TO_HEAD"),
    ).toBe(true);
  });

  it("uses mini-table for A>B>C>A cycle", () => {
    // All have 1 win. Mini-table set/point diffs break the cycle.
    // A beat B 21-10, B beat C 21-15, C beat A 21-19
    // Mini set diffs all 0; point diffs: A: 21+19 vs 10+21 = +9; B: 21+15 vs 10+21 = +5; C: 21+15? wait
    // A: vs B +11 pts, vs C -2 pts → +9
    // B: vs C +6, vs A -11 → -5
    // C: vs A +2, vs B -6 → -4
    // So A > C > B by point difference in mini-table after equal sets.

    const matches = [
      normalMatch("ab", "A", "B", [[21, 10]]),
      normalMatch("bc", "B", "C", [[21, 15]]),
      normalMatch("ca", "C", "A", [[21, 19]]),
    ];

    const rows = calculateStandings({
      entries: [{ id: "A" }, { id: "B" }, { id: "C" }],
      matches,
      rule: defaultStandingRule(),
    });

    expect(rows.map((row) => row.entryId)).toEqual(["A", "C", "B"]);
    expect(rows.every((row) => row.wins === 1)).toBe(true);
  });

  it("falls through set diff to point diff", () => {
    // A and B both 1 win, set diff equal, point diff differs; no H2H yet.
    const matches = [
      normalMatch("a-c", "A", "C", [[21, 10]]), // A +11 points
      normalMatch("b-d", "B", "D", [[21, 18]]), // B +3 points
    ];

    const rows = calculateStandings({
      entries,
      matches,
      rule: {
        criteria: [
          "MATCH_WINS",
          "SET_DIFFERENCE",
          "POINT_DIFFERENCE",
          "ENTRY_ID",
        ],
      },
    });

    expect(rows[0]!.entryId).toBe("A");
    expect(rows[1]!.entryId).toBe("B");
    expect(
      rows[0]!.tieBreakTrace.some(
        (step) => step.criterion === "POINT_DIFFERENCE",
      ),
    ).toBe(true);
  });

  it("applies walkover policy sets/points", () => {
    const rows = calculateStandings({
      entries: [{ id: "A" }, { id: "B" }],
      matches: [
        {
          id: "wo",
          entryAId: "A",
          entryBId: "B",
          winnerEntryId: "A",
          resolution: "WALKOVER",
          sets: [],
        },
      ],
      rule: {
        criteria: ["MATCH_WINS", "ENTRY_ID"],
        specialPolicy: {
          walkover: {
            setsWon: 2,
            setsLost: 0,
            pointsWon: 42,
            pointsLost: 0,
            includePlayedSets: true,
          },
          retirement: {
            setsWon: 2,
            setsLost: 0,
            pointsWon: 0,
            pointsLost: 0,
            includePlayedSets: true,
          },
          disqualification: {
            setsWon: 2,
            setsLost: 0,
            pointsWon: 0,
            pointsLost: 0,
          },
          noShow: {
            setsWon: 2,
            setsLost: 0,
            pointsWon: 42,
            pointsLost: 0,
            includePlayedSets: true,
          },
        },
      },
    });

    expect(rows[0]!.entryId).toBe("A");
    expect(rows[0]!.setsWon).toBe(2);
    expect(rows[0]!.pointsWon).toBe(42);
    expect(rows[1]!.setsLost).toBe(2);
  });

  it("uses scored walkover sets when present (pointsToWin–0)", () => {
    const rows = calculateStandings({
      entries: [{ id: "A" }, { id: "B" }],
      matches: [
        {
          id: "wo",
          entryAId: "A",
          entryBId: "B",
          winnerEntryId: "A",
          resolution: "NO_SHOW",
          sets: [
            { scoreA: 21, scoreB: 0 },
            { scoreA: 21, scoreB: 0 },
          ],
        },
      ],
      rule: defaultStandingRule({ specialPolicy: DEFAULT_SPECIAL_POLICY }),
    });

    expect(rows[0]!.entryId).toBe("A");
    expect(rows[0]!.setsWon).toBe(2);
    expect(rows[0]!.pointsWon).toBe(42);
    expect(rows[0]!.pointDifference).toBe(42);
    expect(rows[1]!.pointDifference).toBe(-42);
  });

  it("is independent of input order", () => {
    const matches = [
      normalMatch("m1", "A", "B", [[21, 19]]),
      normalMatch("m2", "C", "D", [[21, 10]]),
      normalMatch("m3", "A", "C", [[21, 15]]),
    ];

    const rule = defaultStandingRule();
    const forward = calculateStandings({
      entries,
      matches,
      rule,
    });
    const reverse = calculateStandings({
      entries: [...entries].reverse(),
      matches: [...matches].reverse(),
      rule,
    });

    expect(forward.map((row) => `${row.rank}:${row.entryId}`)).toEqual(
      reverse.map((row) => `${row.rank}:${row.entryId}`),
    );
  });

  it("can mark DRAW_REQUIRED when configured", () => {
    const rows = calculateStandings({
      entries: [{ id: "A" }, { id: "B" }],
      matches: [],
      rule: { criteria: ["MATCH_WINS", "DRAW_REQUIRED"] },
    });
    expect(rows.every((row) => row.drawRequired)).toBe(true);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[1]!.rank).toBe(1);
  });
});
