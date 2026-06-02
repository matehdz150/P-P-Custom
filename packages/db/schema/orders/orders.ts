import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../auth/users";
import { providers } from "../auth/providers";
import { products } from "../products/products";
import { userDesigns } from "../user_designs";

// ---- Estados del pedido (flujo del proveedor) ----
export const orderStatusEnum = pgEnum("order_status", [
  "pending",       // recién creado, esperando confirmación del proveedor
  "confirmed",     // proveedor lo aceptó
  "in_production", // en proceso de fabricación
  "shipped",       // enviado al cliente
  "delivered",     // entregado y completado
  "cancelled",     // cancelado por cualquier parte
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Quién compra
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Proveedor que maneja el pedido
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "restrict" }),

  // Producto base y diseño personalizado
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),

  designId: uuid("design_id").references(() => userDesigns.id, {
    onDelete: "set null",
  }),

  // Estado actual del pedido
  status: orderStatusEnum("status").notNull().default("pending"),

  // Detalles del pedido
  quantity: integer("quantity").notNull().default(1),
  totalPrice: varchar("total_price", { length: 20 }), // ej: "199.99"
  notes: text("notes"), // notas del cliente al hacer el pedido

  // Notas internas del proveedor al cambiar estado
  providerNote: text("provider_note"),

  // Snapshot del diseño al momento del pedido (para que el proveedor lo vea)
  designSnapshot: jsonb("design_snapshot"), // { front: "data:...", back: "data:..." }

  // Información de envío
  shippingAddress: jsonb("shipping_address"), // { street, city, state, zip, country }

  // Timestamps clave
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
});

// ---- Historial de cambios de estado ----
export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatusEnum("from_status"),
  toStatus: orderStatusEnum("to_status").notNull(),
  note: text("note"),
  changedBy: varchar("changed_by", { length: 20 }).notNull().default("provider"), // "provider" | "system" | "user"
  createdAt: timestamp("created_at").defaultNow(),
});

// ---- Relaciones ----
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  provider: one(providers, {
    fields: [orders.providerId],
    references: [providers.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  design: one(userDesigns, {
    fields: [orders.designId],
    references: [userDesigns.id],
  }),
  statusHistory: many(orderStatusHistory),
}));

export const orderStatusHistoryRelations = relations(
  orderStatusHistory,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStatusHistory.orderId],
      references: [orders.id],
    }),
  }),
);
