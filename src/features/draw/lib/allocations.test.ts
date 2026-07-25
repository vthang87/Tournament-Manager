import { describe, expect, it } from "vitest";
import {
  allocationFromBuckets,
  bucketsFromResults,
  moveEntryBetweenGroups,
  suggestDrawCapacity,
} from "./allocations";

describe("draw allocation helpers", () => {
  it("round-trips results through buckets", () => {
    const groupIds = ["g1", "g2"];
    const results = [
      { groupId: "g1", entryId: "e1", position: 1 },
      { groupId: "g1", entryId: "e0", position: 0 },
      { groupId: "g2", entryId: "e2", position: 0 },
    ];
    const buckets = bucketsFromResults(groupIds, results);
    expect(buckets).toEqual({
      g1: ["e0", "e1"],
      g2: ["e2"],
    });
    expect(allocationFromBuckets(buckets)).toEqual([
      { groupId: "g1", entryId: "e0", position: 0 },
      { groupId: "g1", entryId: "e1", position: 1 },
      { groupId: "g2", entryId: "e2", position: 0 },
    ]);
  });

  it("moves an entry between groups", () => {
    const moved = moveEntryBetweenGroups(
      { g1: ["a", "b"], g2: ["c"] },
      "b",
      "g2",
      0,
    );
    expect(moved).toEqual({ g1: ["a"], g2: ["b", "c"] });
  });

  it("suggests capacity for 32 entries", () => {
    expect(suggestDrawCapacity(32)).toEqual({
      groupCount: 8,
      capacityPerGroup: 4,
    });
  });
});
