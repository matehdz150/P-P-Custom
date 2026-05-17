// packages/db/schema/products.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { ProductTemplateData, productTemplates } from "./product_template";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),

  slug: varchar("slug", { length: 255 }).notNull().unique(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),

  internalName: varchar("internal_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  brand: varchar("brand", { length: 255 }),

  status: varchar("status", { length: 50 }).notNull().default("draft"),
  // draft | active | archived

  templateId: varchar("template_id", { length: 100 })
  .notNull()
  .references(() => productTemplates.id),
  // 👉 ej: "tshirt", "hoodie", "cap"

  productTemplateData: jsonb("product_template_data")
    .$type<ProductTemplateData>()
    .notNull(),

  isCustomizable: boolean("is_customizable").default(true),

  // proveedor dueño del producto (null = creado por admin)
  providerId: uuid("provider_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});