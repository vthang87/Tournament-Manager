import { describe, expect, it } from "vitest";
import { DomainError } from "@/core/tournament-engine/errors";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules";
import {
  calculateMatchWinner,
  calculateSetWinner,
  ScoringErrorCode,
  validateSetScore,
} from "@/core/tournament-engine/scoring";

const ENTRY_A = "entry-a";
const ENTRY_B = "entry-b";

function standard21(
  overrides: Partial<MatchRuleSnapshot> = {},
): MatchRuleSnapshot {
  return {
    bestOfSets: 3,
    pointsToWin: 21,
    winBy: 2,
    maxPoints: 30,
    deuceEnabled: true,
    decidingSetPoints: null,
    decidingSetWinBy: null,
    decidingSetMaxPoints: null,
    changeEndsEnabled: true,
    changeEndsAt: 11,
    ...overrides,
  };
}

describe("validateSetScore — standard 21 / winBy 2 / max 30", () => {
  const rule = standard21();

  it("accepts 21–19", () => {
    expect(validateSetScore({ scoreA: 21, scoreB: 19, rule }).valid).toBe(true);
  });

  it("rejects 21–20", () => {
    const result = validateSetScore({ scoreA: 21, scoreB: 20, rule });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe(ScoringErrorCode.INVALID_SET_SCORE);
  });

  it("accepts 22–20", () => {
    expect(validateSetScore({ scoreA: 22, scoreB: 20, rule }).valid).toBe(true);
  });

  it("accepts 29–27", () => {
    expect(validateSetScore({ scoreA: 29, scoreB: 27, rule }).valid).toBe(true);
  });

  it("accepts 30–29", () => {
    expect(validateSetScore({ scoreA: 30, scoreB: 29, rule }).valid).toBe(true);
  });

  it("rejects 31–29", () => {
    const result = validateSetScore({ scoreA: 31, scoreB: 29, rule });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (error) =>
          error.code === ScoringErrorCode.EXCEEDS_MAX_POINTS ||
          error.code === ScoringErrorCode.INVALID_SET_SCORE,
      ),
    ).toBe(true);
  });

  it("rejects ties and negative scores", () => {
    expect(validateSetScore({ scoreA: 21, scoreB: 21, rule }).valid).toBe(
      false,
    );
    expect(validateSetScore({ scoreA: -1, scoreB: 21, rule }).valid).toBe(
      false,
    );
  });
});

describe("validateSetScore — deuceEnabled=false", () => {
  const rule = standard21({ deuceEnabled: false });

  it("allows finishing at 21–20 without winBy", () => {
    expect(validateSetScore({ scoreA: 21, scoreB: 20, rule }).valid).toBe(true);
  });

  it("allows 21–19", () => {
    expect(validateSetScore({ scoreA: 21, scoreB: 19, rule }).valid).toBe(true);
  });

  it("rejects continuing past pointsToWin (22–20)", () => {
    expect(validateSetScore({ scoreA: 22, scoreB: 20, rule }).valid).toBe(
      false,
    );
  });
});

describe("calculateSetWinner", () => {
  const rule = standard21();

  it("returns entry A for 21–15", () => {
    expect(
      calculateSetWinner({
        scoreA: 21,
        scoreB: 15,
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toBe(ENTRY_A);
  });

  it("returns null for in-progress 15–10", () => {
    expect(
      calculateSetWinner({
        scoreA: 15,
        scoreB: 10,
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toBeNull();
  });

  it("treats 21–20 as in progress when deuce is enabled", () => {
    expect(
      calculateSetWinner({
        scoreA: 21,
        scoreB: 20,
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toBeNull();
  });

  it("throws for illegal completed-looking scores like 31–29", () => {
    expect(() =>
      calculateSetWinner({
        scoreA: 31,
        scoreB: 29,
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toThrow(DomainError);
  });
});

describe("calculateMatchWinner — best-of-1", () => {
  const rule = standard21({ bestOfSets: 1 });

  it("completes after a single set", () => {
    const outcome = calculateMatchWinner({
      sets: [{ setNumber: 1, scoreA: 21, scoreB: 15 }],
      rule,
      entryIdA: ENTRY_A,
      entryIdB: ENTRY_B,
    });

    expect(outcome.setsToWin).toBe(1);
    expect(outcome.isComplete).toBe(true);
    expect(outcome.winnerEntryId).toBe(ENTRY_A);
    expect(outcome.setsWonA).toBe(1);
    expect(outcome.setsWonB).toBe(0);
  });

  it("rejects a second set after winner", () => {
    expect(() =>
      calculateMatchWinner({
        sets: [
          { setNumber: 1, scoreA: 21, scoreB: 15 },
          { setNumber: 2, scoreA: 21, scoreB: 10 },
        ],
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toThrow(DomainError);

    try {
      calculateMatchWinner({
        sets: [
          { setNumber: 1, scoreA: 21, scoreB: 15 },
          { setNumber: 2, scoreA: 21, scoreB: 10 },
        ],
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      });
    } catch (error) {
      expect((error as DomainError).code).toBe(ScoringErrorCode.EXTRA_SETS);
    }
  });
});

describe("calculateMatchWinner — best-of-3", () => {
  const rule = standard21();

  it("gives A the match 2–1 for 21–15, 18–21, 21–17", () => {
    const outcome = calculateMatchWinner({
      sets: [
        { setNumber: 1, scoreA: 21, scoreB: 15 },
        { setNumber: 2, scoreA: 18, scoreB: 21 },
        { setNumber: 3, scoreA: 21, scoreB: 17 },
      ],
      rule,
      entryIdA: ENTRY_A,
      entryIdB: ENTRY_B,
    });

    expect(outcome.setsToWin).toBe(2);
    expect(outcome.isComplete).toBe(true);
    expect(outcome.winnerEntryId).toBe(ENTRY_A);
    expect(outcome.setsWonA).toBe(2);
    expect(outcome.setsWonB).toBe(1);
  });

  it("ends early after 2–0 without requiring a third set", () => {
    const outcome = calculateMatchWinner({
      sets: [
        { setNumber: 1, scoreA: 21, scoreB: 10 },
        { setNumber: 2, scoreA: 21, scoreB: 12 },
      ],
      rule,
      entryIdA: ENTRY_A,
      entryIdB: ENTRY_B,
    });

    expect(outcome.isComplete).toBe(true);
    expect(outcome.winnerEntryId).toBe(ENTRY_A);
    expect(outcome.sets).toHaveLength(2);
  });

  it("rejects an extra set after a 2–0 winner", () => {
    expect(() =>
      calculateMatchWinner({
        sets: [
          { setNumber: 1, scoreA: 21, scoreB: 10 },
          { setNumber: 2, scoreA: 21, scoreB: 12 },
          { setNumber: 3, scoreA: 21, scoreB: 15 },
        ],
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toThrow(DomainError);
  });
});

describe("calculateMatchWinner — deciding set uses separate points", () => {
  const rule = standard21({
    pointsToWin: 21,
    maxPoints: 30,
    decidingSetPoints: 15,
    decidingSetWinBy: 2,
    decidingSetMaxPoints: 21,
  });

  it("validates deciding set with 15-point rule", () => {
    const outcome = calculateMatchWinner({
      sets: [
        { setNumber: 1, scoreA: 21, scoreB: 15 },
        { setNumber: 2, scoreA: 18, scoreB: 21 },
        { setNumber: 3, scoreA: 15, scoreB: 10 },
      ],
      rule,
      entryIdA: ENTRY_A,
      entryIdB: ENTRY_B,
    });

    expect(outcome.winnerEntryId).toBe(ENTRY_A);
    expect(outcome.sets[2]?.scoreA).toBe(15);
  });

  it("rejects 21–15 as deciding set when deciding points are 15", () => {
    expect(() =>
      calculateMatchWinner({
        sets: [
          { setNumber: 1, scoreA: 21, scoreB: 15 },
          { setNumber: 2, scoreA: 18, scoreB: 21 },
          { setNumber: 3, scoreA: 21, scoreB: 15 },
        ],
        rule,
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toThrow(DomainError);
  });
});

describe("scoring domain errors", () => {
  it("throws on invalid entry ids", () => {
    expect(() =>
      calculateMatchWinner({
        sets: [{ setNumber: 1, scoreA: 21, scoreB: 15 }],
        rule: standard21({ bestOfSets: 1 }),
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_A,
      }),
    ).toThrow(DomainError);
  });

  it("throws on invalid rule in match winner", () => {
    expect(() =>
      calculateMatchWinner({
        sets: [{ setNumber: 1, scoreA: 21, scoreB: 15 }],
        rule: standard21({ bestOfSets: 2 }),
        entryIdA: ENTRY_A,
        entryIdB: ENTRY_B,
      }),
    ).toThrow(DomainError);
  });
});
