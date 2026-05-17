// packages/db/schema/product_sizes.ts
import {
  pgTable,
  uuid,
  varchar,
  numeric,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const productSizes = pgTable("product_sizes", {
  id: uuid("id").primaryKey().defaultRandom(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  size: varchar("size", { length: 10 }).notNull(),

  widthIn: numeric("width_in", {
    precision: 5,
    scale: 2,
  })
    .$type<number>()
    .notNull(),

  lengthIn: numeric("length_in", {
    precision: 5,
    scale: 2,
  })
    .$type<number>()
    .notNull(),
});