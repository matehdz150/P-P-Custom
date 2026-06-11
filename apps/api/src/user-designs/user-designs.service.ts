import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { db } from "../db/connection";
import { eq, and, desc } from "drizzle-orm";
import { userDesigns } from "../../../../packages/db/schema";
import type { SaveDesignDto } from "./dto/save-design-dto";
import { S3Service } from "../uploads/s3.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class UserDesignsService {
  constructor(
    @Inject(S3Service)
    private readonly s3Service: S3Service
  ) {}

  async save(userId: string, dto: SaveDesignDto) {
    let canvasDataDbValue = dto.canvasData;

    // Subir canvasData a S3 y guardar la referencia en la DB
    if (dto.canvasData) {
      const designKey = `designs/${userId}/${uuidv4()}.json`;
      const s3Url = await this.s3Service.uploadJson(designKey, dto.canvasData);
      canvasDataDbValue = { s3Url };
    }

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
          canvasData: canvasDataDbValue ?? existing.canvasData,
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
          canvasData: canvasDataDbValue ?? existingDraft.canvasData,
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
        canvasData: canvasDataDbValue ?? {},
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

    const list = await db.query.userDesigns.findMany({
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

    // Descargar el canvasData de S3 en paralelo para todos los diseños
    await Promise.all(
      list.map(async (design) => {
        if (design.canvasData && typeof design.canvasData === "object" && "s3Url" in design.canvasData) {
          try {
            const s3Url = (design.canvasData as any).s3Url;
            const fullCanvas = await this.s3Service.downloadJson(s3Url);
            design.canvasData = fullCanvas;
          } catch (err) {
            console.error(`Error downloading design ${design.id} from S3:`, err);
          }
        }
      })
    );

    return list;
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

    // Descargar el canvasData de S3 si está almacenado como referencia
    if (design.canvasData && typeof design.canvasData === "object" && "s3Url" in design.canvasData) {
      try {
        const s3Url = (design.canvasData as any).s3Url;
        const fullCanvas = await this.s3Service.downloadJson(s3Url);
        design.canvasData = fullCanvas;
      } catch (err) {
        console.error(`Error downloading design ${design.id} from S3:`, err);
      }
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
