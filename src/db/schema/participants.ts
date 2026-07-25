import {
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tournamentEvents } from "./tournaments";

export const clubs = pgTable("clubs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  logoUrl: text("logo_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  gender: text("gender", {
    enum: ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"],
  })
    .notNull()
    .default("UNSPECIFIED"),
  dateOfBirth: text("date_of_birth"),
  phone: text("phone"),
  email: text("email"),
  clubId: text("club_id").references(() => clubs.id, { onDelete: "set null" }),
  ranking: integer("ranking"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const entries = pgTable("entries", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => tournamentEvents.id, { onDelete: "restrict" }),
  displayName: text("display_name").notNull(),
  seed: integer("seed"),
  ranking: integer("ranking"),
  clubId: text("club_id").references(() => clubs.id, { onDelete: "set null" }),
  status: text("status", {
    enum: ["ACTIVE", "WITHDRAWN", "DISQUALIFIED"],
  })
    .notNull()
    .default("ACTIVE"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const entryMembers = pgTable(
  "entry_members",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "restrict" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.playerId] }),
    uniqueIndex("entry_members_entry_position_uidx").on(
      table.entryId,
      table.position,
    ),
  ],
);
