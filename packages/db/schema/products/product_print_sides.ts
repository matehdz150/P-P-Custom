// packages/db/schema/product_print_sides.ts
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const productPrintSides = pgTable("product_print_sides", {
  id: uuid("id").primaryKey().defaultRandom(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  sideKey: varchar("side_key", { length: 50 }).notNull(),
  // "front" | "back" | "right-sleeve"

  widthCm: integer("width_cm").notNull(),
  heightCm: integer("height_cm").notNull(),

  dpi: integer("dpi").notNull().default(300),

  enabled: boolean("enabled").default(true),
});