import {
	integer,
	pgTable,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../auth/users";
import { userDesigns } from "../user_designs";
import { packages } from "./packages";
import { packageItems } from "./package_items";

/**
 * Sesión/borrador de diseño de un paquete por parte de un cliente.
 * Guarda el progreso para poder salir y continuar después.
 */
export const packageDesigns = pgTable("package_designs", {
	id: uuid("id").primaryKey().defaultRandom(),

	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),

	packageId: uuid("package_id")
		.notNull()
		.references(() => packages.id, { onDelete: "cascade" }),

	// 'draft' | 'completed'
	status: varchar("status", { length: 50 }).notNull().default("draft"),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Asignación de un diseño a UNA unidad concreta de un artículo del paquete.
 * Si un artículo tiene quantity = 10, existen 10 filas (unitIndex 0..9).
 * Varias unidades pueden apuntar al mismo designId (reutilizar el diseño).
 */
export const packageDesignUnits = pgTable(
	"package_design_units",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		packageDesignId: uuid("package_design_id")
			.notNull()
			.references(() => packageDesigns.id, { onDelete: "cascade" }),

		packageItemId: uuid("package_item_id")
			.notNull()
			.references(() => packageItems.id, { onDelete: "cascade" }),

		// Índice de la unidad dentro del artículo (0-based)
		unitIndex: integer("unit_index").notNull(),

		// Diseño asignado a esta unidad (puede ser null = sin diseñar)
		designId: uuid("design_id").references(() => userDesigns.id, {
			onDelete: "set null",
		}),

		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => ({
		uniqueUnit: unique("package_design_units_unique").on(
			t.packageDesignId,
			t.packageItemId,
			t.unitIndex,
		),
	}),
);

export const packageDesignsRelations = relations(
	packageDesigns,
	({ one, many }) => ({
		user: one(users, {
			fields: [packageDesigns.userId],
			references: [users.id],
		}),
		package: one(packages, {
			fields: [packageDesigns.packageId],
			references: [packages.id],
		}),
		units: many(packageDesignUnits),
	}),
);

export const packageDesignUnitsRelations = relations(
	packageDesignUnits,
	({ one }) => ({
		packageDesign: one(packageDesigns, {
			fields: [packageDesignUnits.packageDesignId],
			references: [packageDesigns.id],
		}),
		packageItem: one(packageItems, {
			fields: [packageDesignUnits.packageItemId],
			references: [packageItems.id],
		}),
		design: one(userDesigns, {
			fields: [packageDesignUnits.designId],
			references: [userDesigns.id],
		}),
	}),
);
