import { boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const tournaments = pgTable(
  "tournaments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    location: text("location"),
    timezone: text("timezone").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    status: text("status", {
      enum: [
        "DRAFT",
        "REGISTRATION",
        "DRAW",
        "IN_PROGRESS",
        "COMPLETED",
        "ARCHIVED",
      ],
    })
      .notNull()
      .default("DRAFT"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("tournaments_slug_uidx").on(table.slug)],
);

export const tournamentEvents = pgTable("tournament_events", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["SINGLES", "DOUBLES", "TEAM"],
  }).notNull(),
  genderCategory: text("gender_category", {
    enum: ["MALE", "FEMALE", "MIXED", "OPEN"],
  }).notNull(),
  status: text("status", {
    enum: [
      "SETUP",
      "DRAW_READY",
      "DRAW_CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
    ],
  })
    .notNull()
    .default("SETUP"),
  // App-enforced FK to match_rules.id (avoids circular schema deps with match_rules.event_id).
  defaultMatchRuleId: text("default_match_rule_id"),
  thirdPlaceMatchEnabled: boolean("third_place_match_enabled")
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const courts = pgTable(
  "courts",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    active: boolean("active").notNull().default(true),
    /** Argon2 hash of 4–6 digit referee PIN; null = court scoring link disabled. */
    accessPinHash: text("access_pin_hash"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("courts_tournament_code_uidx").on(
      table.tournamentId,
      table.code,
    ),
  ],
);
