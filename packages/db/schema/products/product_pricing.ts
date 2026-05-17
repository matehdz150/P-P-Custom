// packages/db/schema/product_pricing.ts
import { pgTable, uuid, integer } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productPricing = pgTable("product_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  basePrice: integer("base_price").notNull(),
  // en centavos

  perSidePrice: integer("per_side_price"),
  perDesignPrice: integer("per_design_price"),
  perColorPrice: integer("per_color_price"),
  embroideryExtra: integer("embroidery_extra"),
});