import { Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/connection";
import { eq, and, desc } from "drizzle-orm";
import { userDesigns } from "../../../../packages/db/schema";
import type { SaveDesignDto } from "./dto/save-design-dto";

@Injectable()
export class UserDesignsService {
  async save(userId: string, dto: SaveDesignDto) {
    // 1. Si viene con id explícito, es una actualización de ese diseño
    if (dto.id) {
      const existing = await db.query.userDesigns.findFirst({
        where: and(eq(userDesigns.id, dto.id), eq(userDesigns.userId, userId)),
      });

      if (!existing) {
        throw new NotFoundException("Diseño no encontrado");
      }

      const [updated] = await db
        .update(userDesigns)
        .set({
          name: dto.name ?? existing.name,
          canvasData: dto.canvasData,
          snapshots: dto.snapshots ?? existing.snapshots,
          status: dto.status ?? existing.status,
          updatedAt: new Date(),
        })
        .where(eq(userDesigns.id, dto.id))
        .returning();

      return { id: updated.id };
    }

    // 2. Si no viene id, buscamos si hay un borrador (draft) activo para este producto y usuario
    const existingDraft = await db.query.userDesigns.findFirst({
      where: and(
        eq(userDesigns.userId, userId),
        eq(userDesigns.productId, dto.productId),
        eq(userDesigns.status, "draft")
      ),
    });

    if (existingDraft) {
      // Sobrescribimos el borrador existente
      const [updated] = await db
        .update(userDesigns)
        .set({
          name: dto.name ?? existingDraft.name,
          canvasData: dto.canvasData,
          snapshots: dto.snapshots ?? existingDraft.snapshots,
          status: dto.status ?? "draft",
          updatedAt: new Date(),
        })
        .where(eq(userDesigns.id, existingDraft.id))
        .returning();

      return { id: updated.id };
    }

    // 3. Si no existe borrador previo, creamos uno nuevo
    const [inserted] = await db
      .insert(userDesigns)
      .values({
        userId,
        productId: dto.productId,
        name: dto.name ?? "Mi diseño personalizado",
        canvasData: dto.canvasData,
        snapshots: dto.snapshots ?? {},
        status: dto.status ?? "draft",
      })
      .returning();

    return { id: inserted.id };
  }

  async findAll(userId: string, status?: string, productId?: string) {
    const conditions = [eq(userDesigns.userId, userId)];

    if (status) {
      conditions.push(eq(userDesigns.status, status));
    }

    if (productId) {
      conditions.push(eq(userDesigns.productId, productId));
    }

    return db.query.userDesigns.findMany({
      where: and(...conditions),
      orderBy: desc(userDesigns.updatedAt),
      with: {
        product: {
          with: {
            images: {
              orderBy: (img, { asc }) => asc(img.order),
            },
            pricing: true,
          },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const design = await db.query.userDesigns.findFirst({
      where: and(eq(userDesigns.id, id), eq(userDesigns.userId, userId)),
      with: {
        product: true,
      },
    });

    if (!design) {
      throw new NotFoundException("Diseño no encontrado");
    }

    return design;
  }

  async remove(userId: string, id: string) {
    const [deleted] = await db
      .delete(userDesigns)
      .where(and(eq(userDesigns.id, id), eq(userDesigns.userId, userId)))
      .returning();

    if (!deleted) {
      throw new NotFoundException("Diseño no encontrado o no pertenece al usuario");
    }

    return { ok: true };
  }

  async updateStatus(userId: string, id: string, status: "draft" | "completed") {
    const [updated] = await db
      .update(userDesigns)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(userDesigns.id, id), eq(userDesigns.userId, userId)))
      .returning();

    if (!updated) {
      throw new NotFoundException("Diseño no encontrado");
    }

    return { ok: true };
  }
}
