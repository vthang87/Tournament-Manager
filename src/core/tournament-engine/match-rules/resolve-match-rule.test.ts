import { describe, expect, it } from "vitest";
import { DomainError } from "@/core/tournament-engine/errors";
import {
  createMatchRuleSnapshot,
  MatchRuleErrorCode,
  matchRuleSnapshotSchema,
  resolveMatchRule,
  type MatchRule,
} from "@/core/tournament-engine/match-rules";

function baseRule(overrides: Partial<MatchRule> = {}): MatchRule {
  return {
    id: "rule-1",
    eventId: "event-1",
    name: "Badminton Standard 21",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("matchRuleSnapshotSchema", () => {
  it("accepts a valid odd bestOfSets rule", () => {
    const result = matchRuleSnapshotSchema.safeParse(baseRule());
    expect(result.success).toBe(true);
  });

  it("rejects even bestOfSets", () => {
    const result = matchRuleSnapshotSchema.safeParse(
      baseRule({ bestOfSets: 2 }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      MatchRuleErrorCode.INVALID_BEST_OF_SETS,
    );
  });

  it("rejects non-positive pointsToWin", () => {
    const result = matchRuleSnapshotSchema.safeParse(
      baseRule({ pointsToWin: 0 }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some(
      (issue) => issue.message === MatchRuleErrorCode.INVALID_POINTS_TO_WIN,
    )).toBe(true);
  });

  it("rejects non-positive winBy", () => {
    const result = matchRuleSnapshotSchema.safeParse(baseRule({ winBy: 0 }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some(
      (issue) => issue.message === MatchRuleErrorCode.INVALID_WIN_BY,
    )).toBe(true);
  });

  it("rejects maxPoints < pointsToWin", () => {
    const result = matchRuleSnapshotSchema.safeParse(
      baseRule({ maxPoints: 20, pointsToWin: 21 }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some(
      (issue) => issue.message === MatchRuleErrorCode.INVALID_MAX_POINTS,
    )).toBe(true);
  });

  it("rejects inconsistent deciding-set fields", () => {
    const result = matchRuleSnapshotSchema.safeParse(
      baseRule({
        decidingSetPoints: 15,
        decidingSetWinBy: null,
        decidingSetMaxPoints: 21,
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some(
      (issue) => issue.message === MatchRuleErrorCode.INCONSISTENT_DECIDING_SET,
    )).toBe(true);
  });

  it("accepts consistent deciding-set fields", () => {
    const result = matchRuleSnapshotSchema.safeParse(
      baseRule({
        decidingSetPoints: 15,
        decidingSetWinBy: 2,
        decidingSetMaxPoints: 21,
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("resolveMatchRule", () => {
  it("prefers match override over stage and event default", () => {
    const snapshot = resolveMatchRule({
      matchOverride: createMatchRuleSnapshot(
        baseRule({ pointsToWin: 11, name: "Override" }),
      ),
      stageRule: baseRule({ pointsToWin: 15, name: "Stage" }),
      eventDefaultRule: baseRule({ pointsToWin: 21, name: "Event" }),
    });

    expect(snapshot.pointsToWin).toBe(11);
    expect(snapshot.name).toBe("Override");
  });

  it("falls back to stage rule when no match override", () => {
    const snapshot = resolveMatchRule({
      stageRule: baseRule({ pointsToWin: 15, name: "Stage" }),
      eventDefaultRule: baseRule({ pointsToWin: 21, name: "Event" }),
    });

    expect(snapshot.pointsToWin).toBe(15);
  });

  it("falls back to event default when no override or stage rule", () => {
    const snapshot = resolveMatchRule({
      eventDefaultRule: baseRule({ pointsToWin: 21, name: "Event" }),
    });

    expect(snapshot.pointsToWin).toBe(21);
  });

  it("throws when no rule is resolvable", () => {
    expect(() => resolveMatchRule({})).toThrow(DomainError);
    try {
      resolveMatchRule({});
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(
        MatchRuleErrorCode.RULE_NOT_RESOLVABLE,
      );
    }
  });
});

describe("createMatchRuleSnapshot", () => {
  it("returns a plain snapshot without mutable DB identity fields", () => {
    const rule = baseRule();
    const snapshot = createMatchRuleSnapshot(rule);

    expect(snapshot).toEqual({
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
      name: "Badminton Standard 21",
    });
    expect(snapshot).not.toHaveProperty("id");
    expect(snapshot).not.toHaveProperty("eventId");
    expect(snapshot).not.toHaveProperty("createdAt");
    expect(snapshot).not.toHaveProperty("updatedAt");
  });

  it("does not change when the source rule is mutated later", () => {
    const rule = baseRule();
    const snapshot = createMatchRuleSnapshot(rule);

    rule.pointsToWin = 15;
    rule.maxPoints = 21;
    rule.name = "Mutated";

    expect(snapshot.pointsToWin).toBe(21);
    expect(snapshot.maxPoints).toBe(30);
    expect(snapshot.name).toBe("Badminton Standard 21");
  });
});
