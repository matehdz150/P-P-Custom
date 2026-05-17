/* eslint-disable prettier/prettier */
// apps/api/src/products/products.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { db } from "../db/connection";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { validate as isUUID } from "uuid";

import {
  products,
  productImages,
  productPrintSides,
  productSizes,
  productColors,
  productPricing,
  productCustomizationRules,
  productProduction,
  ProductTemplateData,
  productCategories,
  providers,
} from "../../../../packages/db/schema";

import { productTemplates } from "../../../../packages/db/schema/products/product_template";

import type { CreateProductDto } from "./dto/create_product_dto";
import type { UpdateProductDto } from "./dto/update_product_dto";

function deriveProductTemplate(
  base: ProductTemplateData,
  sides: string[]
): ProductTemplateData {
  return {
    sides,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    sideLabels: Object.fromEntries(sides.map((s) => [s, base.sideLabels[s]])),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    mockups: Object.fromEntries(sides.map((s) => [s, base.mockups[s]])),
    editableAreas: Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      sides.map((s) => [s, base.editableAreas[s]])
    ),
  };
}

@Injectable()
export class ProductsService {
  constructor() {}

  async create(dto: CreateProductDto) {
    return db.transaction(async (tx) => {
      // 1️⃣ Obtener template base
      const baseTemplate = await tx.query.productTemplates.findFirst({
        where: eq(productTemplates.id, dto.templateId),
      });

      if (!baseTemplate) {
        throw new NotFoundException("Template base no encontrado");
      }

      // 2️⃣ Validar sides
      if (!dto.templateSides?.length) {
        throw new Error("El producto debe tener al menos un side");
      }

      for (const side of dto.templateSides) {
        if (!baseTemplate.data.sides.includes(side)) {
          throw new Error(`Side inválido para este template: ${side}`);
        }

        if (!baseTemplate.data.sideLabels[side]) {
          throw new Error(`Falta sideLabel para ${side}`);
        }

        if (!baseTemplate.data.mockups[side]) {
          throw new Error(`Falta mockup para ${side}`);
        }

        if (!baseTemplate.data.editableAreas[side]?.length) {
          throw new Error(`Falta editableArea para ${side}`);
        }
      }

      // 3️⃣ Generar template derivado del producto
      const productTemplateData = deriveProductTemplate(
        baseTemplate.data,
        dto.templateSides
      );

      // 4️⃣ Crear producto
      const [p] = await tx
        .insert(products)
        .values({
          slug: dto.slug,
          sku: dto.sku,
          internalName: dto.internalName,
          name: dto.name,
          description: dto.description,
          brand: dto.brand,
          status: dto.status ?? "active",
          templateId: dto.templateId,
          productTemplateData,
          isCustomizable: dto.isCustomizable ?? true,
          providerId: dto.providerId ?? null,
        })
        .returning();

      // images
      if (dto.images?.length) {
        await tx.insert(productImages).values(
          dto.images.map((img, i) => ({
            productId: p.id,
            url: img.url,
            order: img.order ?? i,
          }))
        );
      }

      // print sides
      if (dto.printSides?.length) {
        await tx.insert(productPrintSides).values(
          dto.printSides.map((s) => ({
            productId: p.id,
            sideKey: s.sideKey,
            widthCm: s.widthCm,
            heightCm: s.heightCm,
            dpi: s.dpi ?? 300,
            enabled: s.enabled ?? true,
          }))
        );
      }

      // 🔥 categories (PIVOT)
      if (dto.categoryIds?.length) {
        await tx.insert(productCategories).values(
          dto.categoryIds.map((categoryId) => ({
            productId: p.id,
            categoryId,
          }))
        );
      }

      // sizes
      if (dto.sizes?.length) {
        await tx.insert(productSizes).values(
          dto.sizes.map((s) => ({
            productId: p.id,
            size: s.size,
            widthIn: s.widthIn,
            lengthIn: s.lengthIn,
          }))
        );
      }

      // colors
      if (dto.colors?.length) {
        await tx.insert(productColors).values(
          dto.colors.map((c) => ({
            productId: p.id,
            name: c.name,
            hex: c.hex,
          }))
        );
      }

      // pricing
      if (dto.pricing) {
        await tx.insert(productPricing).values({
          productId: p.id,
          basePrice: dto.pricing.basePrice,
          perSidePrice: dto.pricing.perSidePrice,
          perDesignPrice: dto.pricing.perDesignPrice,
          perColorPrice: dto.pricing.perColorPrice,
          embroideryExtra: dto.pricing.embroideryExtra,
        });
      }

      // customization rules
      if (dto.customizationRules) {
        await tx.insert(productCustomizationRules).values({
          productId: p.id,
          rules: dto.customizationRules,
        });
      }

      // production
      if (dto.production) {
        await tx.insert(productProduction).values({
          productId: p.id,
          provider: dto.production.provider,
          providerSku: dto.production.providerSku,
          meta: dto.production.meta,
        });
      }

      return { id: p.id };
    });
  }

  findAll() {
    return db.query.products.findMany({
      orderBy: desc(products.createdAt),
      with: {
        images: true,
        printSides: true,
        sizes: true,
        colors: true,
        pricing: true,
        customizationRules: true,
        production: true,
      },
    });
  }

  async findOne(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException("ID de producto inválido");
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        images: true,
        printSides: true,
        sizes: true,
        colors: true,
        pricing: true,
        customizationRules: true,
        production: true,
      },
    });

    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }

    // adjuntar info pública del proveedor (para enlazar a su perfil)
    let provider = null;
    if (product.providerId) {
      provider =
        (await db.query.providers.findFirst({
          where: eq(providers.id, product.providerId),
          columns: {
            id: true,
            slug: true,
            displayName: true,
            name: true,
            avatarUrl: true,
          },
        })) ?? null;
    }

    return { ...product, provider };
  }

  async update(id: string, dto: UpdateProductDto) {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.internalName !== undefined
            ? { internalName: dto.internalName }
            : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
          ...(dto.categoryIds !== undefined ? { category: dto.categoryIds } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.templateId !== undefined
            ? { templateId: dto.templateId }
            : {}),
          ...(dto.isCustomizable !== undefined
            ? { isCustomizable: dto.isCustomizable }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundException("Producto no encontrado");
      }

      /* =========================
       🖼 IMAGES (REPLACE)
    ========================= */
      if (dto.images !== undefined) {
        await tx.delete(productImages).where(eq(productImages.productId, id));

        if (dto.images.length > 0) {
          await tx.insert(productImages).values(
            dto.images.map((img, i) => ({
              productId: id,
              url: img.url,
              order: img.order ?? i,
            }))
          );
        }
      }

      /* =========================
       🖨 PRINT SIDES (REPLACE)
    ========================= */
      if (dto.printSides !== undefined) {
        await tx
          .delete(productPrintSides)
          .where(eq(productPrintSides.productId, id));

        if (dto.printSides.length > 0) {
          await tx.insert(productPrintSides).values(
            dto.printSides.map((s) => ({
              productId: id,
              sideKey: s.sideKey,
              widthCm: s.widthCm,
              heightCm: s.heightCm,
              dpi: s.dpi ?? 300,
              enabled: s.enabled ?? true,
            }))
          );
        }
      }

      /* =========================
       📐 SIZES (REPLACE)
    ========================= */
      if (dto.sizes !== undefined) {
        await tx.delete(productSizes).where(eq(productSizes.productId, id));

        if (dto.sizes.length > 0) {
          await tx.insert(productSizes).values(
            dto.sizes.map((s) => ({
              productId: id,
              size: s.size,
              widthIn: s.widthIn,
              lengthIn: s.lengthIn,
            }))
          );
        }
      }

      /* =========================
       🎨 COLORS (REPLACE)
    ========================= */
      if (dto.colors !== undefined) {
        await tx.delete(productColors).where(eq(productColors.productId, id));

        if (dto.colors.length > 0) {
          await tx.insert(productColors).values(
            dto.colors.map((c) => ({
              productId: id,
              name: c.name,
              hex: c.hex,
            }))
          );
        }
      }

      /* =========================
       💰 PRICING (REPLACE 1–1)
    ========================= */
      if (dto.pricing !== undefined) {
        await tx.delete(productPricing).where(eq(productPricing.productId, id));

        if (dto.pricing) {
          await tx.insert(productPricing).values({
            productId: id,
            basePrice: dto.pricing.basePrice,
            perSidePrice: dto.pricing.perSidePrice,
            perDesignPrice: dto.pricing.perDesignPrice,
            perColorPrice: dto.pricing.perColorPrice,
            embroideryExtra: dto.pricing.embroideryExtra,
          });
        }
      }

      /* =========================
       🧠 CUSTOMIZATION RULES
    ========================= */
      if (dto.customizationRules !== undefined) {
        await tx
          .delete(productCustomizationRules)
          .where(eq(productCustomizationRules.productId, id));

        if (dto.customizationRules) {
          await tx.insert(productCustomizationRules).values({
            productId: id,
            rules: dto.customizationRules,
          });
        }
      }

      /* =========================
       🏭 PRODUCTION
    ========================= */
      if (dto.production !== undefined) {
        await tx
          .delete(productProduction)
          .where(eq(productProduction.productId, id));

        if (dto.production) {
          await tx.insert(productProduction).values({
            productId: id,
            provider: dto.production.provider,
            providerSku: dto.production.providerSku,
            meta: dto.production.meta,
          });
        }
      }

      /* =========================
   🗂 CATEGORIES (REPLACE)
========================= */
      if (dto.categoryIds !== undefined) {
        await tx
          .delete(productCategories)
          .where(eq(productCategories.productId, id));

        if (dto.categoryIds.length > 0) {
          await tx.insert(productCategories).values(
            dto.categoryIds.map((categoryId) => ({
              productId: id,
              categoryId,
            }))
          );
        }
      }

      return { ok: true };
    });
  }

  async remove(id: string) {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!deleted) throw new NotFoundException("Producto no encontrado");
    return { ok: true };
  }

  //Catalogo

  findForCatalog() {
    return db.query.products.findMany({
      where: eq(products.status, "active"),
      orderBy: desc(products.createdAt),
      columns: {
        id: true,
        name: true,
        brand: true,
        category: true,
        description: true,
      },
      with: {
        images: {
          orderBy: (img, { asc }) => asc(img.order),
          columns: {
            url: true,
            order: true,
          },
        },
        pricing: {
          columns: {
            basePrice: true,
          },
        },
      },
    });
  }
}
