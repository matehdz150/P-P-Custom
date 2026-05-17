import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  provider: varchar("provider", { length: 50 }).notNull(), // google | apple
  providerAccountId: varchar("provider_account_id", {
    length: 255,
  }).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});