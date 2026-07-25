import { describe, expect, it } from "vitest";
import { orderPlacementsForCeremony } from "./ceremony-order";

describe("orderPlacementsForCeremony", () => {
  it("puts seeds before unseeded and sorts seeds ascending", () => {
    const ordered = orderPlacementsForCeremony([
      {
        groupId: "g2",
        entryId: "e3",
        position: 1,
        displayName: "C",
        seed: null,
        clubCode: null,
        clubName: null,
      },
      {
        groupId: "g1",
        entryId: "e2",
        position: 1,
        displayName: "B",
        seed: 2,
        clubCode: null,
        clubName: null,
      },
      {
        groupId: "g1",
        entryId: "e1",
        position: 0,
        displayName: "A",
        seed: 1,
        clubCode: null,
        clubName: null,
      },
    ]);
    expect(ordered.map((p) => p.entryId)).toEqual(["e1", "e2", "e3"]);
  });
});

describe("formatClubLabel", () => {
  it("joins code and name", async () => {
    const { formatClubLabel } = await import("./ceremony-order");
    expect(formatClubLabel("GVS", "Golden Viet Sport")).toBe(
      "GVS · Golden Viet Sport",
    );
    expect(formatClubLabel(null, "Only Name")).toBe("Only Name");
    expect(formatClubLabel("GVS", null)).toBe("GVS");
    expect(formatClubLabel("Same", "Same")).toBe("Same");
  });
});
