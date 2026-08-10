import { describe, expect, it } from "vitest";
import { MatchRuleErrorCode, matchRuleSchema } from "./index";

describe("match-rules schemas", () => {
  const valid = {
    id: "r1",
    eventId: "e1",
    name: "Fast Group Stage",
    bestOfSets: 1,
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
  };

  it("accepts best-of-1", () => {
    expect(matchRuleSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative bestOfSets", () => {
    const result = matchRuleSchema.safeParse({ ...valid, bestOfSets: -1 });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (issue) => issue.message === MatchRuleErrorCode.INVALID_BEST_OF_SETS,
      ),
    ).toBe(true);
  });

  it("rejects deciding max below deciding points", () => {
    const result = matchRuleSchema.safeParse({
      ...valid,
      decidingSetPoints: 15,
      decidingSetWinBy: 2,
      decidingSetMaxPoints: 11,
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (issue) => issue.message === MatchRuleErrorCode.INVALID_MAX_POINTS,
      ),
    ).toBe(true);
  });
});
