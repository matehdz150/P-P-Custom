import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Proveedores: cuentas creadas por el admin, login con email + contraseña.
export const providers = pgTable("providers", {
	id: uuid("id").defaultRandom().primaryKey(),

	email: varchar("email", { length: 255 }).notNull().unique(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	name: varchar("name", { length: 255 }),

	// perfil público
	slug: varchar("slug", { length: 120 }).unique(),
	displayName: varchar("display_name", { length: 255 }),
	bio: text("bio"),
	avatarUrl: text("avatar_url"),
	bannerUrl: text("banner_url"),

	createdAt: timestamp("created_at").defaultNow(),
});

// Sesiones de proveedor (separadas de las de clientes).
export const providerSessions = pgTable("provider_sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	providerId: uuid("provider_id").notNull(),
	refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	revokedAt: timestamp("revoked_at"),
});
