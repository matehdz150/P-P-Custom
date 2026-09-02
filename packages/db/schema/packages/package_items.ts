import {
	boolean,
	integer,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { packages } from "./packages";
import { products } from "../products";

export const packageItems = pgTable("package_items", {
	id: uuid("id").primaryKey().defaultRandom(),

	packageId: uuid("package_id")
		.notNull()
		.references(() => packages.id, { onDelete: "cascade" }),

	productId: uuid("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),

	quantity: integer("quantity").notNull(),

	designRequired: boolean("design_required").default(true),

	createdAt: timestamp("created_at").defaultNow(),
});
