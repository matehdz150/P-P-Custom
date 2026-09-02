import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),

	email: varchar("email", { length: 255 }).notNull().unique(),
	name: varchar("name", { length: 255 }),

	// null para cuentas creadas por OAuth (Google)
	passwordHash: varchar("password_hash", { length: 255 }),

	createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
}));
