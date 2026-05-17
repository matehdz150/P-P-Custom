// packages_pricing.ts
import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { packages } from "./packages";

export const packagePricing = pgTable("package_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),

  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "cascade" }),

  basePrice: integer("base_price").notNull(),
  // precio total del paquete

  discountPercentage: integer("discount_percentage"),
  // opcional: ej 10 = 10%

  createdAt: timestamp("created_at").defaultNow(),
});