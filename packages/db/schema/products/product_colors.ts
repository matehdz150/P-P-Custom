// packages/db/schema/product_colors.ts
import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productColors = pgTable("product_colors", {
  id: uuid("id").primaryKey().defaultRandom(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 100 }).notNull(),
  hex: varchar("hex", { length: 7 }),
});