import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/connection";
import {
  packageDesignUnits,
  packageDesigns,
  packages,
  userDesigns,
} from "../../../../packages/db/schema";
import type { SetUnitDto } from "./dto/package-design.dto";

@Injectable()
export class PackageDesignsService {
  /**
   * Devuelve el borrador de diseño del paquete para este usuario, creándolo si
   * no existe, y reconcilia las "unidades" (1 fila por unidad de cada artículo)
   * con la composición actual del paquete. Así se conserva el progreso aunque
   * el proveedor edite el paquete.
   */
  async ensure(userId: string, packageId: string) {
    const pkg = await db.query.packages.findFirst({
      where: eq(packages.id, packageId),
      with: { items: true },
    });
    if (!pkg) throw new NotFoundException("Paquete no encontrado");

    // 1) Buscar borrador existente o crear uno
    let design = await db.query.packageDesigns.findFirst({
      where: and(
        eq(packageDesigns.userId, userId),
        eq(packageDesigns.packageId, packageId),
        eq(packageDesigns.status, "draft"),
      ),
      orderBy: desc(packageDesigns.updatedAt),
    });

    if (!design) {
      const [created] = await db
        .insert(packageDesigns)
        .values({ userId, packageId, status: "draft" })
        .returning();
      design = created;
    }

    // 2) Reconciliar unidades
    const expected = new Set<string>(); // `${itemId}:${index}`
    for (const item of pkg.items) {
      for (let i = 0; i < item.quantity; i++) {
        expected.add(`${item.id}:${i}`);
      }
    }

    const existing = await db.query.packageDesignUnits.findMany({
      where: eq(packageDesignUnits.packageDesignId, design.id),
    });

    const existingKeys = new Set(
      existing.map((u) => `${u.packageItemId}:${u.unitIndex}`),
    );

    // Insertar las que faltan
    const toInsert: {
      packageDesignId: string;
      packageItemId: string;
      unitIndex: number;
    }[] = [];
    for (const item of pkg.items) {
      for (let i = 0; i < item.quantity; i++) {
        if (!existingKeys.has(`${item.id}:${i}`)) {
          toInsert.push({
            packageDesignId: design.id,
            packageItemId: item.id,
            unitIndex: i,
          });
        }
      }
    }
    if (toInsert.length) {
      await db.insert(packageDesignUnits).values(toInsert);
    }

    // Borrar las que sobran (artículos eliminados o cantidad reducida)
    const toDelete = existing
      .filter((u) => !expected.has(`${u.packageItemId}:${u.unitIndex}`))
      .map((u) => u.id);
    if (toDelete.length) {
      await db
        .delete(packageDesignUnits)
        .where(inArray(packageDesignUnits.id, toDelete));
    }

    return this.findOne(userId, design.id);
  }

  /** Lista los borradores de diseño de paquete del usuario (para el dashboard). */
  async findMine(userId: string) {
    return db.query.packageDesigns.findMany({
      where: and(
        eq(packageDesigns.userId, userId),
        eq(packageDesigns.status, "draft"),
      ),
      orderBy: desc(packageDesigns.updatedAt),
      with: {
        units: { columns: { id: true, designId: true } },
        package: {
          columns: { id: true, name: true, image: true },
          with: { items: { columns: { id: true, quantity: true } } },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const design = await db.query.packageDesigns.findFirst({
      where: and(
        eq(packageDesigns.id, id),
        eq(packageDesigns.userId, userId),
      ),
      with: {
        units: {
          with: {
            design: true,
          },
        },
        package: {
          with: {
            items: {
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
            },
            pricing: true,
          },
        },
      },
    });

    if (!design) throw new NotFoundException("Diseño de paquete no encontrado");
    return design;
  }

  /**
   * Asigna (o quita) un diseño a una o varias unidades del paquete.
   * Permite reutilizar el mismo diseño en varias unidades.
   */
  async setUnits(userId: string, id: string, units: SetUnitDto[]) {
    const design = await db.query.packageDesigns.findFirst({
      where: and(
        eq(packageDesigns.id, id),
        eq(packageDesigns.userId, userId),
      ),
    });
    if (!design) throw new NotFoundException("Diseño de paquete no encontrado");

    // Validar que los diseños referenciados pertenezcan al usuario
    const designIds = Array.from(
      new Set(units.map((u) => u.designId).filter((d): d is string => !!d)),
    );
    if (designIds.length) {
      const owned = await db.query.userDesigns.findMany({
        where: and(
          inArray(userDesigns.id, designIds),
          eq(userDesigns.userId, userId),
        ),
        columns: { id: true },
      });
      if (owned.length !== designIds.length) {
        throw new BadRequestException(
          "Uno o más diseños no pertenecen al usuario",
        );
      }
    }

    for (const u of units) {
      await db
        .update(packageDesignUnits)
        .set({ designId: u.designId, updatedAt: new Date() })
        .where(
          and(
            eq(packageDesignUnits.packageDesignId, id),
            eq(packageDesignUnits.packageItemId, u.packageItemId),
            eq(packageDesignUnits.unitIndex, u.unitIndex),
          ),
        );
    }

    await db
      .update(packageDesigns)
      .set({ updatedAt: new Date() })
      .where(eq(packageDesigns.id, id));

    return this.findOne(userId, id);
  }

  async updateStatus(
    userId: string,
    id: string,
    status: "draft" | "completed",
  ) {
    const [updated] = await db
      .update(packageDesigns)
      .set({ status, updatedAt: new Date() })
      .where(
        and(eq(packageDesigns.id, id), eq(packageDesigns.userId, userId)),
      )
      .returning();

    if (!updated) throw new NotFoundException("Diseño de paquete no encontrado");
    return { ok: true };
  }
}
