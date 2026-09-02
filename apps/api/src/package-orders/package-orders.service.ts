import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/connection";
import {
  packageDesigns,
  packageOrderItems,
  packageOrderStatusHistory,
  packageOrders,
} from "../../../../packages/db/schema";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

// Transiciones válidas que puede hacer el PROVEEDOR (idénticas a orders)
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class PackageOrdersService {
  // ---- Crear un pedido de paquete a partir de un borrador de diseño ----
  async createFromDesign(
    userId: string,
    packageDesignId: string,
    dto: { notes?: string; shippingAddress?: Record<string, string> },
  ) {
    const design = await db.query.packageDesigns.findFirst({
      where: and(
        eq(packageDesigns.id, packageDesignId),
        eq(packageDesigns.userId, userId),
      ),
      with: {
        units: { with: { design: true } },
        package: {
          with: {
            items: { with: { product: true } },
            pricing: true,
          },
        },
      },
    });

    if (!design) {
      throw new NotFoundException("Diseño de paquete no encontrado");
    }

    const pkg = design.package as typeof design.package & {
      providerId?: string | null;
      pricing?: { basePrice: number } | null;
      items?: { id: string; productId: string }[];
    };

    if (!pkg) throw new NotFoundException("Paquete no encontrado");

    // Validar que todas las unidades tienen un diseño asignado
    const units = design.units ?? [];
    if (units.length === 0) {
      throw new BadRequestException("El paquete no tiene unidades por diseñar");
    }
    const unassigned = units.filter((u) => !u.designId);
    if (unassigned.length > 0) {
      throw new BadRequestException(
        "Todas las unidades deben tener un diseño antes de confirmar el pedido",
      );
    }

    // Mapa packageItemId -> productId
    const itemProduct = new Map<string, string>();
    for (const it of pkg.items ?? []) {
      itemProduct.set(it.id, it.productId);
    }

    // Agrupar unidades por (packageItemId + designId)
    type Group = {
      productId: string;
      designId: string;
      quantity: number;
      designSnapshot: Record<string, unknown>;
      designAssets: Record<string, unknown>;
    };
    const groups = new Map<string, Group>();
    for (const u of units) {
      const productId = itemProduct.get(u.packageItemId);
      if (!productId || !u.designId) continue;
      const key = `${u.packageItemId}:${u.designId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        const d = u.design as
          | {
              designSnapshot?: Record<string, unknown> | null;
              designAssets?: Record<string, unknown> | null;
              snapshots?: Record<string, unknown> | null;
            }
          | null
          | undefined;
        groups.set(key, {
          productId,
          designId: u.designId,
          quantity: 1,
          // Preferimos el compuesto HD; si no existe usamos los snapshots normales
          designSnapshot: (d?.designSnapshot ??
            d?.snapshots ??
            {}) as Record<string, unknown>,
          designAssets: (d?.designAssets ?? {}) as Record<string, unknown>,
        });
      }
    }

    const total = (pkg.pricing?.basePrice ?? 0).toFixed(2);
    const providerId = pkg.providerId ?? null;

    // Crear el pedido del paquete
    const [order] = await db
      .insert(packageOrders)
      .values({
        userId,
        packageId: pkg.id,
        packageDesignId: design.id,
        providerId,
        status: "pending",
        totalPrice: total,
        notes: dto.notes,
        shippingAddress: (dto.shippingAddress ?? {}) as Record<string, unknown>,
      })
      .returning();

    // Crear las líneas del pedido
    const itemRows = Array.from(groups.values()).map((g) => ({
      packageOrderId: order.id,
      productId: g.productId,
      designId: g.designId,
      quantity: g.quantity,
      designSnapshot: g.designSnapshot,
      designAssets: g.designAssets,
    }));
    if (itemRows.length) {
      await db.insert(packageOrderItems).values(itemRows);
    }

    // Historial
    await db.insert(packageOrderStatusHistory).values({
      packageOrderId: order.id,
      fromStatus: null,
      toStatus: "pending",
      note: "Pedido de paquete creado",
      changedBy: "system",
    });

    // Marcar el diseño de paquete como completado
    await db
      .update(packageDesigns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(packageDesigns.id, design.id));

    return { id: order.id, status: order.status };
  }

  // ---- Listar pedidos de paquete del usuario ----
  async getByUser(userId: string) {
    return db.query.packageOrders.findMany({
      where: eq(packageOrders.userId, userId),
      orderBy: desc(packageOrders.createdAt),
      with: {
        package: { columns: { id: true, name: true, image: true } },
        items: {
          with: {
            product: {
              columns: { id: true, name: true },
              with: {
                images: { limit: 1, orderBy: (i, { asc }) => asc(i.order) },
              },
            },
          },
        },
        statusHistory: { orderBy: desc(packageOrderStatusHistory.createdAt) },
      },
    });
  }

  // ---- Listar pedidos de paquete del proveedor ----
  async getByProvider(providerId: string, status?: string) {
    const where = status
      ? and(
          eq(packageOrders.providerId, providerId),
          eq(packageOrders.status, status as OrderStatus),
        )
      : eq(packageOrders.providerId, providerId);

    return db.query.packageOrders.findMany({
      where,
      orderBy: desc(packageOrders.createdAt),
      with: {
        package: { columns: { id: true, name: true, image: true } },
        items: {
          with: {
            product: {
              columns: { id: true, name: true },
              with: {
                images: { limit: 1, orderBy: (i, { asc }) => asc(i.order) },
              },
            },
          },
        },
        statusHistory: {
          orderBy: desc(packageOrderStatusHistory.createdAt),
          limit: 5,
        },
      },
    });
  }

  // ---- Detalle de un pedido de paquete (proveedor) ----
  async getProviderDetail(providerId: string, id: string) {
    const order = await db.query.packageOrders.findFirst({
      where: and(
        eq(packageOrders.id, id),
        eq(packageOrders.providerId, providerId),
      ),
      with: {
        package: { columns: { id: true, name: true, image: true } },
        items: {
          with: {
            product: {
              columns: { id: true, name: true },
              with: {
                images: { orderBy: (i, { asc }) => asc(i.order) },
              },
            },
          },
        },
        statusHistory: { orderBy: desc(packageOrderStatusHistory.createdAt) },
      },
    });

    if (!order) throw new NotFoundException("Pedido no encontrado");
    return order;
  }

  // ---- Cambiar estado (proveedor) ----
  async updateStatus(
    providerId: string,
    id: string,
    dto: { status: OrderStatus; note?: string },
  ) {
    const order = await db.query.packageOrders.findFirst({
      where: and(
        eq(packageOrders.id, id),
        eq(packageOrders.providerId, providerId),
      ),
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
      .update(packageOrders)
      .set({
        status: dto.status,
        providerNote: dto.note ?? order.providerNote,
        ...timestamps,
      })
      .where(eq(packageOrders.id, id));

    await db.insert(packageOrderStatusHistory).values({
      packageOrderId: id,
      fromStatus: currentStatus,
      toStatus: dto.status,
      note: dto.note,
      changedBy: "provider",
    });

    return { ok: true, status: dto.status };
  }
}
