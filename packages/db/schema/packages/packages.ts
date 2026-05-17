import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: text("categories").array(),
  
  image: text("image"),

  status: varchar("status", { length: 50 }).default("draft"),
  // draft | active | archived

  createdAt: timestamp("created_at").defaultNow(),
});