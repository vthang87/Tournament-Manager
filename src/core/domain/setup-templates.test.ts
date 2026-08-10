import { describe, expect, it } from "vitest";
import { SPORT_IDS } from "./sports";
import {
  EVENT_SETUP_TEMPLATES,
  MATCH_RULE_PRESETS,
  getEventSetupTemplate,
  getMatchRulePreset,
} from "./setup-templates";

describe("sport-scoped setup templates", () => {
  it("assigns every preset and template to a supported sport", () => {
    const supported = new Set<string>(Object.values(SPORT_IDS));
    for (const preset of MATCH_RULE_PRESETS) {
      expect(supported.has(preset.sportId)).toBe(true);
    }
    for (const template of EVENT_SETUP_TEMPLATES) {
      expect(supported.has(template.sportId)).toBe(true);
    }
  });

  it("keeps badminton and pickleball presets separated", () => {
    expect(
      MATCH_RULE_PRESETS.filter(
        (preset) => preset.sportId === SPORT_IDS.BADMINTON,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      MATCH_RULE_PRESETS.filter(
        (preset) => preset.sportId === SPORT_IDS.PICKLEBALL,
      ).length,
    ).toBeGreaterThan(0);
    expect(getMatchRulePreset("pickleball-standard-bo3-11")?.sportId).toBe(
      SPORT_IDS.PICKLEBALL,
    );
    expect(getEventSetupTemplate("badminton-bwf-standard")?.sportId).toBe(
      SPORT_IDS.BADMINTON,
    );
  });
});
