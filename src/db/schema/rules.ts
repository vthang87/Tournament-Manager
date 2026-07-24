import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { tournamentEvents } from "./tournaments";

export const matchRules = sqliteTable("match_rules", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => tournamentEvents.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  bestOfSets: integer("best_of_sets").notNull(),
  pointsToWin: integer("points_to_win").notNull(),
  winBy: integer("win_by").notNull(),
  maxPoints: integer("max_points").notNull(),
  deuceEnabled: integer("deuce_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  decidingSetPoints: integer("deciding_set_points"),
  decidingSetWinBy: integer("deciding_set_win_by"),
  decidingSetMaxPoints: integer("deciding_set_max_points"),
  changeEndsEnabled: integer("change_ends_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  changeEndsAt: integer("change_ends_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const stages = sqliteTable(
  "stages",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => tournamentEvents.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    format: text("format", {
      enum: ["GROUP", "KNOCKOUT"],
    }).notNull(),
    status: text("status", {
      enum: ["PENDING", "ACTIVE", "COMPLETED"],
    })
      .notNull()
      .default("PENDING"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("stages_event_order_uidx").on(table.eventId, table.orderIndex),
  ],
);

export const stageRules = sqliteTable("stage_rules", {
  stageId: text("stage_id")
    .primaryKey()
    .references(() => stages.id, { onDelete: "restrict" }),
  matchRuleId: text("match_rule_id")
    .notNull()
    .references(() => matchRules.id, { onDelete: "restrict" }),
});

export const standingRules = sqliteTable("standing_rules", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => tournamentEvents.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  /** Ordered criteria list (JSON), Zod-validated at write boundary. */
  criteriaJson: text("criteria_json").notNull(),
  specialPolicyJson: text("special_policy_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const qualificationRules = sqliteTable("qualification_rules", {
  id: text("id").primaryKey(),
  sourceStageId: text("source_stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "restrict" }),
  targetStageId: text("target_stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "restrict" }),
  topPerGroup: integer("top_per_group").notNull(),
  bestAdditionalEntries: integer("best_additional_entries").notNull().default(0),
  additionalFromRank: integer("additional_from_rank"),
  rankingCriteriaJson: text("ranking_criteria_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scheduleRules = sqliteTable("schedule_rules", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => tournamentEvents.id, { onDelete: "restrict" }),
  stageId: text("stage_id").references(() => stages.id, {
    onDelete: "restrict",
  }),
  defaultMatchDurationMinutes: integer("default_match_duration_minutes")
    .notNull()
    .default(45),
  minimumRestMinutes: integer("minimum_rest_minutes").notNull().default(15),
  courtChangeBufferMinutes: integer("court_change_buffer_minutes")
    .notNull()
    .default(5),
  hardRestConflicts: integer("hard_rest_conflicts", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
