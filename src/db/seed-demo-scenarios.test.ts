import { describe, expect, it } from "vitest";
import type { MatchRecord } from "@/core/domain";
import {
  DEMO_SCENARIOS,
  normalScoreForMatch,
  playerName,
} from "./seed-demo-scenarios";

function matchWithRule(
  bestOfSets: number,
  pointsToWin: number,
): MatchRecord {
  return {
    id: "match",
    eventId: "event",
    stageId: "stage",
    groupId: null,
    roundNumber: 0,
    bracketPosition: 0,
    entryAId: "entry-a",
    entryBId: "entry-b",
    winnerEntryId: null,
    status: "PENDING",
    resolution: null,
    ruleSnapshotJson: JSON.stringify({
      bestOfSets,
      pointsToWin,
      winBy: 2,
      maxPoints: 99,
      deuceEnabled: true,
      decidingSetPoints: null,
      decidingSetWinBy: null,
      decidingSetMaxPoints: null,
      changeEndsEnabled: true,
      changeEndsAt: 6,
    }),
    generationKey: null,
    courtId: null,
    scheduledAt: null,
    estimatedDurationMinutes: null,
    warmupUntil: null,
    startedAt: null,
    completedAt: null,
    nextMatchId: null,
    nextMatchSlot: null,
    loserNextMatchId: null,
    loserNextMatchSlot: null,
    isThirdPlace: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("demo scenario definitions", () => {
  it("defines three states for each sport with unique seed namespaces", () => {
    expect(DEMO_SCENARIOS).toHaveLength(6);
    expect(new Set(DEMO_SCENARIOS.map((scenario) => scenario.prefix)).size).toBe(
      6,
    );
    expect(new Set(DEMO_SCENARIOS.map((scenario) => scenario.slug)).size).toBe(
      6,
    );

    for (const sport of ["badminton", "pickleball"]) {
      expect(
        DEMO_SCENARIOS.filter((scenario) => scenario.sport === sport).map(
          (scenario) => scenario.state,
        ),
      ).toEqual(["draw-ready", "knockout-live", "completed"]);
    }
  });

  it("builds a legal one-game result for group/playoff rules", () => {
    expect(normalScoreForMatch(matchWithRule(1, 15), 2)).toEqual([
      { setNumber: 1, scoreA: 15, scoreB: 8 },
    ]);
  });

  it("builds straight and deciding-game results for best-of-three rules", () => {
    expect(normalScoreForMatch(matchWithRule(3, 11), 1)).toHaveLength(2);
    expect(normalScoreForMatch(matchWithRule(3, 11), 3)).toEqual([
      { setNumber: 1, scoreA: 11, scoreB: 6 },
      { setNumber: 2, scoreA: 5, scoreB: 11 },
      { setNumber: 3, scoreA: 11, scoreB: 4 },
    ]);
  });

  it("cycles demo player names for all 64 roster slots without undefined", () => {
    for (let index = 0; index < 64; index += 1) {
      for (const sport of ["badminton", "pickleball"] as const) {
        const name = playerName(sport, index);
        expect(name).not.toContain("undefined");
        expect(name.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
