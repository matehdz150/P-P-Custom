import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const packageCategories = pgTable("package_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});