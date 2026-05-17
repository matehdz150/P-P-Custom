/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
// categories/categories.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/connection";
import {
  categories,
  packageCategories,
  packageCategoryItems,
  productCategories,
} from "../../../../packages/db/schema/categories";
import { eq, ilike } from "drizzle-orm";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreatePackageCategoryDto } from "./dto/create-packageCategory.dto";
import { packagePricing, packages, productImages, productPricing, products } from "../../../../packages/db/schema";

@Injectable()
export class CategoriesService {
  async findAll() {
    return db.select().from(categories).orderBy(categories.createdAt);
  }

  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!category) {
      throw new NotFoundException("Categoría no encontrada");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return category;
  }

  async create(data: CreateCategoryDto) {
    const [category] = await db.insert(categories).values(data).returning();

    return category;
  }

  async update(id: string, data: UpdateCategoryDto) {
    const [category] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();

    if (!category) {
      throw new NotFoundException("Categoría no encontrada");
    }

    return category;
  }

  async remove(id: string) {
    const [deleted] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException("Categoría no encontrada");
    }

    return { ok: true };
  }

  async findProducts(categoryId: string) {
    // 1. Validar categoría
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const exists = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!exists) {
      throw new NotFoundException("Categoría no existe");
    }

    // 2. Traer productos con TODO
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        basePrice: productPricing.basePrice,
        imageUrl: productImages.url,
        imageOrder: productImages.order,
      })
      .from(productCategories)
      .innerJoin(products, eq(productCategories.productId, products.id))
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .leftJoin(productPricing, eq(productPricing.productId, products.id))
      .where(eq(productCategories.categoryId, categoryId));

    // 3. Normalizar (agrupar imágenes por producto)
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        description?: string | null;
        basePrice?: number;
        images: { url: string }[];
      }
    >();

    for (const row of rows) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description,
          basePrice: row.basePrice ?? undefined,
          images: [],
        });
      }

      if (row.imageUrl) {
        map.get(row.id)!.images.push({
          url: row.imageUrl,
        });
      }
    }

    return Array.from(map.values());
  }

  //PACKAGES
  async findAllPackageCategories() {
    return (
      db
        .select()
        .from(packageCategories)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        .orderBy(packageCategories.createdAt)
    );
  }

  async createPackageCategory(data: CreatePackageCategoryDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [category] = await db
      .insert(packageCategories)
      .values(data)
      .returning();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return category;
  }

  async findOnePackageCategory(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const category = await db.query.packageCategories.findFirst({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where: eq(packageCategories.id, id),
    });

    if (!category) {
      throw new NotFoundException("Categoría de paquete no encontrada");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return category;
  }

  async findPackageCategoryWithPackagesByName(name: string) {
    // 1. Buscar categoría por name
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const category = await db.query.packageCategories.findFirst({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      where: ilike(packageCategories.name, name),
    });

    if (!category) {
      throw new NotFoundException(
        `Categoría de paquete con nombre "${name}" no encontrada`
      );
    }

    // 2. JOIN REAL usando TU tabla pivote
    const relatedPackages = await db
      .select({
        id: packages.id,
        name: packages.name,
        description: packages.description,
        status: packages.status,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        image: packages.image,
        createdAt: packages.createdAt,

        // ✅ precio del paquete
        basePrice: packagePricing.basePrice,
      })
      .from(packages)
      .innerJoin(
        packageCategoryItems,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        eq(packageCategoryItems.packageId, packages.id)
      )
      .innerJoin(packagePricing, eq(packagePricing.packageId, packages.id))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      .where(eq(packageCategoryItems.categoryId, category.id));

    // 3. Regresar categoría + paquetes
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
      ...category,
      packages: relatedPackages,
    };
  }

  async findPackages(categoryId: string) {
    // 1. Validar que la categoría exista (SIN db.query)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [exists] = await db
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      .select({ id: packageCategories.id })
      .from(packageCategories)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      .where(eq(packageCategories.id, categoryId))
      .limit(1);

    if (!exists) {
      throw new NotFoundException("Categoría de paquete no existe");
    }

    // 2. JOIN explícito con la tabla pivote
    const results = await db
      .select({
        id: packages.id,
        name: packages.name,
        description: packages.description,
        status: packages.status,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        image: packages.image,
        createdAt: packages.createdAt,
      })
      .from(packages)
      .innerJoin(
        packageCategoryItems,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        eq(packageCategoryItems.packageId, packages.id)
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      .where(eq(packageCategoryItems.categoryId, categoryId));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return results;
  }
}
