/* eslint-disable prettier/prettier */
import { Injectable } from "@nestjs/common";
import { db } from "../db/connection";
import {
  packages,
  packageItems,
  packagePricing,
  packageCategoryItems,
} from "../../../../packages/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { CreatePackageDto } from "./dto/create-packages.dto";
import { UpdatePackageDto } from "./dto/update-packages.dto";

@Injectable()
export class PackagesService {
  async create(dto: CreatePackageDto) {
  if (!dto.items.length) {
    throw new Error("El paquete debe tener al menos un producto");
  }

  return db.transaction(async (tx) => {
    // 1️⃣ Crear paquete
    const inserted = await tx
      .insert(packages)
      .values({
        name: dto.name,
        description: dto.description ?? null,
        image: dto.image ?? null,
        status: "draft",
      })
      .returning({ id: packages.id });

    const pkg = inserted[0];
    if (!pkg) throw new Error("No se pudo crear el paquete");

    // 2️⃣ 🔥 INSERTAR RELACIÓN CON CATEGORÍAS (ESTO FALTABA)
    if (dto.categories?.length) {
      await tx.insert(packageCategoryItems).values(
        dto.categories.map((categoryId) => ({
          packageId: pkg.id,
          categoryId,
        }))
      );
    }

    // 3️⃣ Items
    await tx.insert(packageItems).values(
      dto.items.map((item) => ({
        packageId: pkg.id,
        productId: item.productId,
        quantity: item.quantity,
        designRequired: true,
      }))
    );

    // 4️⃣ Pricing
    await tx.insert(packagePricing).values({
      packageId: pkg.id,
      basePrice: dto.pricing.basePrice,
    });

    return { id: pkg.id };
  });
}

  async findAll(filters?: {
  category?: string;
  limit?: number;
}) {
  const where = filters?.category
    ? sql`${packages.category} @> ARRAY[${filters.category}]::text[]`
    : undefined;

  return db.query.packages.findMany({
    where,
    with: {
      items: { with: { product: true } },
      pricing: true,
    },
    orderBy: [desc(packages.createdAt)],
    limit: filters?.limit,
  });
}

  async findOne(id: string) {
  const pkg = await db.query.packages.findFirst({
    where: eq(packages.id, id),
    with: {
      items: {
        with: {
          product: {
            with: {
              pricing: true,
              colors: true,
              sizes:true,
              printSides: true,
              images: true,
            },
          },
        },
      },
      pricing: true,
    },
  });

  if (!pkg) throw new Error("Paquete no encontrado");
  return pkg;
}

  async update(id: string, dto: UpdatePackageDto) {
    return db.transaction(async (tx) => {
      await tx
        .update(packages)
        .set({
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.categories !== undefined ? { category: dto.categories } : {}),
          ...(dto.image !== undefined ? { image: dto.image } : {}),
        })
        .where(eq(packages.id, id));

      if (dto.items) {
        await tx.delete(packageItems).where(eq(packageItems.packageId, id));

        await tx.insert(packageItems).values(
          dto.items.map((item) => ({
            packageId: id,
            productId: item.productId,
            quantity: item.quantity,
            designRequired: true,
          }))
        );
      }

      if (dto.pricing) {
        await tx.delete(packagePricing).where(eq(packagePricing.packageId, id));

        await tx.insert(packagePricing).values({
          packageId: id,
          basePrice: dto.pricing.basePrice,
        });
      }

      return { ok: true };
    });
  }

  async remove(id: string) {
    await db.delete(packages).where(eq(packages.id, id));
    return { ok: true };
  }
}
