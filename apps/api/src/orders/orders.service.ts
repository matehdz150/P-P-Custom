import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { db } from "../db/connection";
import { eq, and, desc } from "drizzle-orm";
import {
  orders,
  orderStatusHistory,
  userDesigns,
} from "../../../../packages/db/schema";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

// Transiciones válidas que puede hacer el PROVEEDOR
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  // ---- Crear pedido (usuario autenticado) ----
  async createOrder(
    userId: string,
    dto: {
      designId: string;
      quantity?: number;
      notes?: string;
      shippingAddress?: Record<string, string>;
      designSnapshot?: Record<string, string>;
      designAssets?: Record<string, unknown[]>;
    },
  ) {
    // Recuperar el diseño y validar que pertenece al usuario
    const design = await db.query.userDesigns.findFirst({
      where: and(
        eq(userDesigns.id, dto.designId),
        eq(userDesigns.userId, userId),
      ),
      with: {
        product: {
          with: { pricing: true },
        },
      },
    });

    if (!design) {
      throw new NotFoundException("Diseño no encontrado");
    }

    const product = design.product as typeof design.product & {
      pricing?: { basePrice: number } | null;
      providerId?: string | null;
    };

    if (!product) {
      throw new NotFoundException("Producto del diseño no encontrado");
    }

    if (!product.providerId) {
      throw new BadRequestException(
        "Este producto no tiene proveedor asignado",
      );
    }

    const qty = dto.quantity ?? 1;
    const unitPrice = product.pricing?.basePrice ?? 0;
    const total = (unitPrice * qty).toFixed(2);

    const [order] = await db
      .insert(orders)
      .values({
        userId,
        providerId: product.providerId,
        productId: product.id,
        designId: design.id,
        status: "pending",
        quantity: qty,
        totalPrice: total,
        notes: dto.notes,
        designSnapshot: (dto.designSnapshot ??
          design.snapshots ??
          {}) as Record<string, unknown>,
        designAssets: (dto.designAssets ?? {}) as Record<string, unknown>,
        shippingAddress: (dto.shippingAddress ?? {}) as Record<string, unknown>,
      })
      .returning();

    // Registrar en historial
    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: "pending",
      note: "Pedido creado",
      changedBy: "system",
    });

    // Marcar el diseño como completed
    await db
      .update(userDesigns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(userDesigns.id, design.id));

    return { id: order.id, status: order.status };
  }

  // ---- Listar pedidos del usuario ----
  async getOrdersByUser(userId: string) {
    return db.query.orders.findMany({
      where: eq(orders.userId, userId),
      orderBy: desc(orders.createdAt),
      with: {
        product: {
          columns: { id: true, name: true },
          with: { images: { limit: 1, orderBy: (i, { asc }) => asc(i.order) } },
        },
        provider: { columns: { id: true, name: true, displayName: true } },
        statusHistory: { orderBy: desc(orderStatusHistory.createdAt) },
      },
    });
  }

  // ---- Listar pedidos del proveedor ----
  async getOrdersByProvider(providerId: string, status?: string) {
    const baseQuery = status
      ? and(
          eq(orders.providerId, providerId),
          eq(orders.status, status as OrderStatus),
        )
      : eq(orders.providerId, providerId);

    return db.query.orders.findMany({
      where: baseQuery,
      orderBy: desc(orders.createdAt),
      with: {
        product: {
          columns: { id: true, name: true },
          with: { images: { limit: 1, orderBy: (i, { asc }) => asc(i.order) } },
        },
        statusHistory: {
          orderBy: desc(orderStatusHistory.createdAt),
          limit: 5,
        },
      },
    });
  }

  // ---- Detalle de un pedido (proveedor) ----
  async getOrderDetail(providerId: string, orderId: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.providerId, providerId)),
      with: {
        product: { with: { images: true, pricing: true } },
        statusHistory: { orderBy: desc(orderStatusHistory.createdAt) },
      },
    });

    if (!order) throw new NotFoundException("Pedido no encontrado");
    return order;
  }

  // ---- Cambiar estado del pedido (proveedor) ----
  async updateOrderStatus(
    providerId: string,
    orderId: string,
    dto: { status: OrderStatus; note?: string },
  ) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.providerId, providerId)),
    });

    if (!order) throw new NotFoundException("Pedido no encontrado");

    const currentStatus = order.status as OrderStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `No se puede pasar de "${currentStatus}" a "${dto.status}"`,
      );
    }

    const now = new Date();
    const timestamps: Record<string, Date> = { updatedAt: now };
    if (dto.status === "confirmed") timestamps.confirmedAt = now;
    if (dto.status === "shipped") timestamps.shippedAt = now;
    if (dto.status === "delivered") timestamps.deliveredAt = now;
    if (dto.status === "cancelled") timestamps.cancelledAt = now;

    await db
      .update(orders)
      .set({
        status: dto.status,
        providerNote: dto.note ?? order.providerNote,
        ...timestamps,
      })
      .where(eq(orders.id, orderId));

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: currentStatus,
      toStatus: dto.status,
      note: dto.note,
      changedBy: "provider",
    });

    return { ok: true, status: dto.status };
  }
}
