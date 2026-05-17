// packages/db/schema/product_images.ts
import { pgTable, uuid, integer, text } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  url: text("url").notNull(),
  order: integer("order").default(0),
});