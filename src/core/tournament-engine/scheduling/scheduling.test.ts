import { describe, expect, it } from "vitest";
import {
  generateBulkSchedule,
  intervalsOverlap,
  validateSchedule,
  type ScheduleRule,
} from "@/core/tournament-engine/scheduling";

describe("generateBulkSchedule", () => {
  it("fills courts in parallel without overlapping entries", () => {
    const assignments = generateBulkSchedule({
      matches: [
        { id: "M1", entryAId: "E1", entryBId: "E2" },
        { id: "M2", entryAId: "E1", entryBId: "E3" },
        { id: "M3", entryAId: "E4", entryBId: "E5" },
        { id: "M4", entryAId: "E6", entryBId: "E7" },
      ],
      matchIds: ["M1", "M2", "M3", "M4"],
      courtIds: ["C1", "C2", "C3"],
      startTime: "2026-07-20T08:00:00.000Z",
      slotMinutes: 30,
    });

    expect(assignments).toEqual([
      {
        matchId: "M1",
        courtId: "C1",
        startTime: "2026-07-20T08:00:00.000Z",
      },
      {
        matchId: "M3",
        courtId: "C2",
        startTime: "2026-07-20T08:00:00.000Z",
      },
      {
        matchId: "M4",
        courtId: "C3",
        startTime: "2026-07-20T08:00:00.000Z",
      },
      {
        matchId: "M2",
        courtId: "C1",
        startTime: "2026-07-20T09:00:00.000Z",
      },
    ]);
  });

  it("uses the selected slot duration between waves", () => {
    const assignments = generateBulkSchedule({
      matches: [
        {
          id: "M1",
          entryAId: "E1",
          entryBId: "E2",
          estimatedDurationMinutes: 50,
        },
        { id: "M2", entryAId: "E3", entryBId: "E4" },
        { id: "M3", entryAId: "E5", entryBId: "E6" },
      ],
      matchIds: ["M1", "M2", "M3"],
      courtIds: ["C1", "C2"],
      startTime: "2026-07-20T08:00:00.000Z",
      slotMinutes: 45,
    });

    expect(assignments[2]?.startTime).toBe("2026-07-20T08:45:00.000Z");
  });

  it("keeps the same player out of simultaneous cross-entry matches", () => {
    const assignments = generateBulkSchedule({
      matches: [
        { id: "M1", entryAId: "TEAM-A", entryBId: "TEAM-B" },
        { id: "M2", entryAId: "TEAM-C", entryBId: "TEAM-D" },
      ],
      matchIds: ["M1", "M2"],
      courtIds: ["C1", "C2"],
      startTime: "2026-07-20T08:00:00.000Z",
      slotMinutes: 30,
      entryPlayerIds: {
        "TEAM-A": ["P1"],
        "TEAM-C": ["P1"],
      },
    });

    expect(assignments[1]?.startTime).toBe("2026-07-20T09:00:00.000Z");
  });

  it("places another match between consecutive appearances of an entry", () => {
    const assignments = generateBulkSchedule({
      matches: [
        { id: "M1", entryAId: "E1", entryBId: "E2" },
        { id: "M2", entryAId: "E1", entryBId: "E3" },
        { id: "M3", entryAId: "E4", entryBId: "E5" },
      ],
      matchIds: ["M1", "M2", "M3"],
      courtIds: ["C1"],
      startTime: "2026-07-20T08:00:00.000Z",
      slotMinutes: 30,
    });

    expect(assignments.map((assignment) => assignment.matchId)).toEqual([
      "M1",
      "M3",
      "M2",
    ]);
    expect(assignments.map((assignment) => assignment.startTime)).toEqual([
      "2026-07-20T08:00:00.000Z",
      "2026-07-20T08:30:00.000Z",
      "2026-07-20T09:00:00.000Z",
    ]);
  });
});

const rule: ScheduleRule = {
  defaultMatchDurationMinutes: 30,
  minimumRestMinutes: 30,
  courtChangeBufferMinutes: 15,
};

const courts = [
  { id: "C1", active: true },
  { id: "C2", active: true },
  { id: "C3", active: false },
];

const matches = [
  { id: "M1", entryAId: "E1", entryBId: "E2" },
  { id: "M2", entryAId: "E3", entryBId: "E4" },
  { id: "M3", entryAId: "E1", entryBId: "E3" },
  { id: "M4", entryAId: "E5", entryBId: "E6" },
];

describe("intervalsOverlap", () => {
  it("treats touching boundaries as non-overlapping (half-open)", () => {
    expect(
      intervalsOverlap(
        { startMs: 0, endMs: 30 },
        { startMs: 30, endMs: 60 },
      ),
    ).toBe(false);
    expect(
      intervalsOverlap(
        { startMs: 0, endMs: 31 },
        { startMs: 30, endMs: 60 },
      ),
    ).toBe(true);
  });
});

describe("validateSchedule", () => {
  it("detects court overlap", () => {
    const conflicts = validateSchedule({
      matches,
      courts,
      rule,
      assignments: [
        {
          matchId: "M1",
          courtId: "C1",
          startTime: "2026-07-20T08:00:00.000Z",
        },
        {
          matchId: "M2",
          courtId: "C1",
          startTime: "2026-07-20T08:15:00.000Z",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "COURT_OVERLAP")).toBe(true);
  });

  it("allows back-to-back on the same court (boundary)", () => {
    const conflicts = validateSchedule({
      matches,
      courts,
      rule,
      assignments: [
        {
          matchId: "M1",
          courtId: "C1",
          startTime: "2026-07-20T08:00:00.000Z",
        },
        {
          matchId: "M2",
          courtId: "C1",
          startTime: "2026-07-20T08:30:00.000Z",
        },
      ],
    });
    expect(conflicts.filter((c) => c.code === "COURT_OVERLAP")).toHaveLength(0);
  });

  it("detects entry overlap", () => {
    const conflicts = validateSchedule({
      matches,
      courts,
      rule,
      assignments: [
        {
          matchId: "M1",
          courtId: "C1",
          startTime: "2026-07-20T08:00:00.000Z",
        },
        {
          matchId: "M3",
          courtId: "C2",
          startTime: "2026-07-20T08:10:00.000Z",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "ENTRY_OVERLAP")).toBe(true);
  });

  it("detects player overlap across entries", () => {
    const conflicts = validateSchedule({
      matches: [
        { id: "M1", entryAId: "TEAM-A", entryBId: "TEAM-B" },
        { id: "M2", entryAId: "TEAM-C", entryBId: "TEAM-D" },
      ],
      courts,
      rule,
      entryPlayerIds: {
        "TEAM-A": ["P1", "P2"],
        "TEAM-B": ["P3", "P4"],
        "TEAM-C": ["P1", "P5"],
        "TEAM-D": ["P6", "P7"],
      },
      assignments: [
        {
          matchId: "M1",
          courtId: "C1",
          startTime: "2026-07-20T08:00:00.000Z",
        },
        {
          matchId: "M2",
          courtId: "C2",
          startTime: "2026-07-20T08:00:00.000Z",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "PLAYER_OVERLAP")).toBe(true);
  });

  it("detects insufficient rest", () => {
    const conflicts = validateSchedule({
      matches,
      courts,
      rule,
      assignments: [
        {
          matchId: "M1",
          courtId: "C1",
          startTime: "2026-07-20T08:00:00.000Z",
        },
        {
          matchId: "M3",
          courtId: "C1",
          startTime: "2026-07-20T08:30:00.000Z",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "INSUFFICIENT_REST")).toBe(true);
  });

  it("detects inactive court", () => {
    const conflicts = validateSchedule({
      matches,
      courts,
      rule,
      assignments: [
        {
          matchId: "M4",
          courtId: "C3",
          startTime: "2026-07-20T08:00:00.000Z",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "INACTIVE_COURT")).toBe(true);
  });

  it("detects court-change buffer violation", () => {
    const conflicts = validateSchedule({
      matches,
      courts,
      rule: {
        ...rule,
        minimumRestMinutes: 0,
        courtChangeBufferMinutes: 20,
      },
      assignments: [
        {
          matchId: "M1",
          courtId: "C1",
          startTime: "2026-07-20T08:00:00.000Z",
        },
        {
          matchId: "M3",
          courtId: "C2",
          startTime: "2026-07-20T08:30:00.000Z",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "COURT_CHANGE_BUFFER")).toBe(true);
  });
});
