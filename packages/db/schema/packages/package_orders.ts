import {
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../auth/users";
import { providers } from "../auth/providers";
import { products } from "../products/products";
import { userDesigns } from "../user_designs";
import { orderStatusEnum } from "../orders/orders";
import { packages } from "./packages";
import { packageDesigns } from "./package_designs";

/**
 * Pedido de un PAQUETE. Agrupa todos los artículos del paquete con sus
 * diseños asignados. Reutiliza el enum de estados de los pedidos normales.
 */
export const packageOrders = pgTable("package_orders", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Quién compra
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),

	// Paquete base
	packageId: uuid("package_id")
		.notNull()
		.references(() => packages.id, { onDelete: "restrict" }),

	// Borrador de diseño del que se generó (referencia informativa)
	packageDesignId: uuid("package_design_id").references(
		() => packageDesigns.id,
		{ onDelete: "set null" },
	),

	// Proveedor dueño del paquete (null = paquete de admin)
	providerId: uuid("provider_id").references(() => providers.id, {
		onDelete: "set null",
	}),

	status: orderStatusEnum("status").notNull().default("pending"),

	totalPrice: varchar("total_price", { length: 20 }),
	notes: text("notes"),
	providerNote: text("provider_note"),

	shippingAddress: jsonb("shipping_address"),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
	confirmedAt: timestamp("confirmed_at"),
	shippedAt: timestamp("shipped_at"),
	deliveredAt: timestamp("delivered_at"),
	cancelledAt: timestamp("cancelled_at"),
});

/**
 * Una línea del pedido del paquete: una combinación (producto + diseño) con la
 * cantidad de unidades que la usan. Ej: "Camisa — Diseño A ×5".
 * Lleva una copia del compuesto HD y los componentes para el proveedor.
 */
export const packageOrderItems = pgTable("package_order_items", {
	id: uuid("id").primaryKey().defaultRandom(),

	packageOrderId: uuid("package_order_id")
		.notNull()
		.references(() => packageOrders.id, { onDelete: "cascade" }),

	productId: uuid("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "restrict" }),

	designId: uuid("design_id").references(() => userDesigns.id, {
		onDelete: "set null",
	}),

	// Número de unidades de este artículo que usan este diseño
	quantity: integer("quantity").notNull().default(1),

	// Snapshot HD del diseño al momento del pedido
	designSnapshot: jsonb("design_snapshot"),
	// Componentes HD exportados por separado
	designAssets: jsonb("design_assets"),

	createdAt: timestamp("created_at").defaultNow(),
});

/** Historial de cambios de estado del pedido de paquete. */
export const packageOrderStatusHistory = pgTable(
	"package_order_status_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		packageOrderId: uuid("package_order_id")
			.notNull()
			.references(() => packageOrders.id, { onDelete: "cascade" }),
		fromStatus: orderStatusEnum("from_status"),
		toStatus: orderStatusEnum("to_status").notNull(),
		note: text("note"),
		changedBy: varchar("changed_by", { length: 20 })
			.notNull()
			.default("provider"),
		createdAt: timestamp("created_at").defaultNow(),
	},
);

// ---- Relaciones ----
export const packageOrdersRelations = relations(
	packageOrders,
	({ one, many }) => ({
		user: one(users, {
			fields: [packageOrders.userId],
			references: [users.id],
		}),
		package: one(packages, {
			fields: [packageOrders.packageId],
			references: [packages.id],
		}),
		provider: one(providers, {
			fields: [packageOrders.providerId],
			references: [providers.id],
		}),
		items: many(packageOrderItems),
		statusHistory: many(packageOrderStatusHistory),
	}),
);

export const packageOrderItemsRelations = relations(
	packageOrderItems,
	({ one }) => ({
		packageOrder: one(packageOrders, {
			fields: [packageOrderItems.packageOrderId],
			references: [packageOrders.id],
		}),
		product: one(products, {
			fields: [packageOrderItems.productId],
			references: [products.id],
		}),
		design: one(userDesigns, {
			fields: [packageOrderItems.designId],
			references: [userDesigns.id],
		}),
	}),
);

export const packageOrderStatusHistoryRelations = relations(
	packageOrderStatusHistory,
	({ one }) => ({
		packageOrder: one(packageOrders, {
			fields: [packageOrderStatusHistory.packageOrderId],
			references: [packageOrders.id],
		}),
	}),
);
