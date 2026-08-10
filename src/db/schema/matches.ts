import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { groups } from "./draw";
import { entries } from "./participants";
import { stages } from "./rules";
import { courts, tournamentEvents } from "./tournaments";

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => tournamentEvents.id, { onDelete: "restrict" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "restrict" }),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "restrict",
    }),
    roundNumber: integer("round_number").notNull(),
    bracketPosition: integer("bracket_position"),
    entryAId: text("entry_a_id").references(() => entries.id, {
      onDelete: "restrict",
    }),
    entryBId: text("entry_b_id").references(() => entries.id, {
      onDelete: "restrict",
    }),
    winnerEntryId: text("winner_entry_id").references(() => entries.id, {
      onDelete: "restrict",
    }),
    status: text("status", {
      enum: [
        "PENDING",
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "WALKOVER",
        "CANCELLED",
      ],
    })
      .notNull()
      .default("PENDING"),
    resolution: text("resolution", {
      enum: [
        "NORMAL",
        "WALKOVER",
        "RETIREMENT",
        "DISQUALIFICATION",
        "NO_SHOW",
      ],
    }),
    ruleSnapshotJson: text("rule_snapshot_json").notNull(),
    /** Stable engine id for knockout (e.g. stageId:R0-M0); null for group matches. */
    generationKey: text("generation_key"),
    courtId: text("court_id").references(() => courts.id, {
      onDelete: "restrict",
    }),
    scheduledAt: text("scheduled_at"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    /** Countdown target while teams are called to court (pre-start). Null = not called. */
    warmupUntil: text("warmup_until"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    nextMatchId: text("next_match_id"),
    nextMatchSlot: text("next_match_slot", { enum: ["A", "B"] }),
    loserNextMatchId: text("loser_next_match_id"),
    loserNextMatchSlot: text("loser_next_match_slot", { enum: ["A", "B"] }),
    isThirdPlace: boolean("is_third_place").notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("matches_generation_key_uidx").on(table.generationKey),
    index("matches_event_idx").on(table.eventId),
    index("matches_stage_idx").on(table.stageId),
    index("matches_group_idx").on(table.groupId),
  ],
);

export const matchSets = pgTable(
  "match_sets",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    setNumber: integer("set_number").notNull(),
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    winnerEntryId: text("winner_entry_id").references(() => entries.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("match_sets_match_set_number_uidx").on(
      table.matchId,
      table.setNumber,
    ),
  ],
);
