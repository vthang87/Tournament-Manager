import { boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const sports = pgTable(
  "sports",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("sports_code_uidx").on(table.code)],
);
