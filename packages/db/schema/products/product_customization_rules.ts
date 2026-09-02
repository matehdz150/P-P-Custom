// packages/db/schema/product_customization_rules.ts
import { pgTable, uuid, jsonb } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productCustomizationRules = pgTable(
	"product_customization_rules",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		rules: jsonb("rules").notNull(),
	},
);
