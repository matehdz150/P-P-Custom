import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
	id: uuid("id").defaultRandom().primaryKey(),

	name: text("name").notNull(),

	description: text("description"),

	image: text("image").notNull(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});
