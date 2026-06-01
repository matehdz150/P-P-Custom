import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth/users";
import { products } from "./products/products";

export const userDesigns = pgTable("user_designs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  // canvasData guardará la serialización de todos los lados (ej: { front: {...}, back: {...} })
  canvasData: jsonb("canvas_data").notNull(),
  // snapshots guardará imágenes en base64 de previsualización (ej: { front: "data:...", back: "data:..." })
  snapshots: jsonb("snapshots"),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft' | 'completed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userDesignsRelations = relations(userDesigns, ({ one }) => ({
  user: one(users, {
    fields: [userDesigns.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [userDesigns.productId],
    references: [products.id],
  }),
}));
