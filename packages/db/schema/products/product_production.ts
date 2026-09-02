// packages/db/schema/product_production.ts
import { pgTable, uuid, varchar, jsonb } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productProduction = pgTable("product_production", {
	id: uuid("id").primaryKey().defaultRandom(),

	productId: uuid("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),

	provider: varchar("provider", { length: 100 }),
	providerSku: varchar("provider_sku", { length: 255 }),

	meta: jsonb("meta"),
});
