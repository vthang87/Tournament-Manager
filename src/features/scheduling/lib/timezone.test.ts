import { describe, expect, it } from "vitest";
import {
  buildTimeSlots,
  formatTournamentTime,
  utcIsoToZonedLocal,
  zonedLocalToUtcIso,
} from "@/features/scheduling/lib/timezone";

describe("scheduling timezone helpers", () => {
  it("converts wall-clock tournament time to UTC and back", () => {
    const tz = "Asia/Ho_Chi_Minh";
    const utc = zonedLocalToUtcIso("2026-07-20T09:00", tz);
    expect(utc).toBe("2026-07-20T02:00:00.000Z");
    expect(utcIsoToZonedLocal(utc, tz)).toBe("2026-07-20T09:00");
    expect(formatTournamentTime(utc, tz)).toBe("09:00");
  });

  it("builds half-hour slots", () => {
    const slots = buildTimeSlots(
      "2026-07-20T01:00:00.000Z",
      "2026-07-20T03:00:00.000Z",
      30,
    );
    expect(slots).toHaveLength(4);
    expect(slots[0]).toBe("2026-07-20T01:00:00.000Z");
    expect(slots[3]).toBe("2026-07-20T02:30:00.000Z");
  });
});
