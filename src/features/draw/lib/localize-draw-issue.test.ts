import { describe, expect, it } from "vitest";
import { localizeDrawIssue } from "./localize-draw-issue";
import type { DrawEntryView, DrawGroupView } from "../components/draw-board";

const t = (key: string, values?: Record<string, string | number>) => {
  const templates: Record<string, string> = {
    group: "Bảng",
    unknownGroup: "Bảng không xác định",
    unknownClub: "CLB không xác định",
    unknownTeam: "Đội không xác định",
    unknownRegion: "Vùng không xác định",
    issueSameClub:
      "Bảng {group}: {count} đội cùng CLB {club} ({entries}).",
    issueSameTeam: "Bảng {group}: {count} đội cùng đội {team} ({entries}).",
    issueSameRegion:
      "Bảng {group}: {count} đội cùng vùng {region} ({entries}).",
    issueSeedDistribution:
      "Hạt giống {seed} — {entry} đang ở {actualGroup}, nên ở {expectedGroup}.",
  };
  let text = templates[key] ?? key;
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
};

describe("localizeDrawIssue", () => {
  const groupsById = new Map<string, DrawGroupView>([
    ["g1", { id: "g1", name: "Bảng A", code: "A" }],
    ["g2", { id: "g2", name: "Bảng B", code: "B" }],
  ]);

  const entriesById = new Map<string, DrawEntryView>([
    [
      "e1",
      {
        id: "e1",
        displayName: "Nguyễn A / Trần B",
        seed: 1,
        clubId: "club-1",
        clubCode: "GVS",
        clubName: "Gò Vấp Smash",
      },
    ],
    [
      "e2",
      {
        id: "e2",
        displayName: "Lê C / Phạm D",
        seed: null,
        clubId: "club-1",
        clubCode: "GVS",
        clubName: "Gò Vấp Smash",
      },
    ],
  ]);

  it("formats same-club warnings with group and club labels", () => {
    const text = localizeDrawIssue(
      {
        code: "DRAW_SAME_CLUB",
        message: "raw",
        severity: "warning",
        groupId: "g1",
        attributeId: "club-1",
        entityIds: ["e1", "e2"],
      },
      { groupsById, entriesById, t },
    );

    expect(text).toContain("Bảng A");
    expect(text).toContain("GVS · Gò Vấp Smash");
    expect(text).toContain("Nguyễn A / Trần B");
    expect(text).not.toContain("club-1");
    expect(text).not.toContain("d79868eb");
  });
});
