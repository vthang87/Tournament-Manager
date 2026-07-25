import {
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { entries } from "./participants";
import { stages } from "./rules";
import { tournamentEvents } from "./tournaments";

export const drawSessions = pgTable("draw_sessions", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => tournamentEvents.id, { onDelete: "restrict" }),
  stageId: text("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "restrict" }),
  randomSeed: text("random_seed").notNull(),
  configurationSnapshotJson: text("configuration_snapshot_json").notNull(),
  status: text("status", {
    enum: ["DRAFT", "CONFIRMED", "LOCKED"],
  })
    .notNull()
    .default("DRAFT"),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull(),
  confirmedAt: text("confirmed_at"),
});

export const groups = pgTable(
  "groups",
  {
    id: text("id").primaryKey(),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("groups_stage_code_uidx").on(table.stageId, table.code),
    uniqueIndex("groups_stage_order_uidx").on(table.stageId, table.orderIndex),
  ],
);

export const drawResults = pgTable(
  "draw_results",
  {
    drawSessionId: text("draw_session_id")
      .notNull()
      .references(() => drawSessions.id, { onDelete: "restrict" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.drawSessionId, table.entryId] }),
    uniqueIndex("draw_results_session_group_position_uidx").on(
      table.drawSessionId,
      table.groupId,
      table.position,
    ),
  ],
);

export const groupEntries = pgTable(
  "group_entries",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    seedPosition: integer("seed_position"),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.entryId] }),
    uniqueIndex("group_entries_group_position_uidx").on(
      table.groupId,
      table.position,
    ),
  ],
);
