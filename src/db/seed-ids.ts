/** Stable seed IDs used by the idempotent seed script and local fixtures. */
export const SEED_IDS = {
  adminUser: "seed-user-admin",
  tournament: "seed-tournament-open-2026",
  eventMensDoubles: "seed-event-mens-doubles",
  ruleGroup: "seed-rule-group-bo1-21",
  ruleKnockout: "seed-rule-knockout-bo3-15",
  ruleFinal: "seed-rule-final-bo3-21",
  stageGroup: "seed-stage-group",
  stageKnockout: "seed-stage-knockout",
  courts: [
    "seed-court-1",
    "seed-court-2",
    "seed-court-3",
    "seed-court-4",
  ] as const,
} as const;
