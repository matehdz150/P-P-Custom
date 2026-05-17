import { relations } from "drizzle-orm";

import { products } from "./products";
import { productTemplates } from "./product_template";
import { productImages } from "./product_images";
import { productPrintSides } from "./product_print_sides";
import { productSizes } from "./product_sizes";
import { productColors } from "./product_colors";
import { productPricing } from "./product_pricing";
import { productCustomizationRules } from "./product_customization_rules";
import { productProduction } from "./product_production";

import { productCategories } from "../categories";


/* =========================
   PRODUCTS (ROOT)
========================= */

export const productsRelations = relations(products, ({ many, one }) => ({
  images: many(productImages),
  printSides: many(productPrintSides),
  sizes: many(productSizes),
  colors: many(productColors),

  pricing: one(productPricing),
  customizationRules: one(productCustomizationRules),
  production: one(productProduction),

  // ✅ TEMPLATE (product → template)
  template: one(productTemplates, {
    fields: [products.templateId],
    references: [productTemplates.id],
  }),
  productCategories: many(productCategories),
}));

/* =========================
   PRODUCT IMAGES
========================= */

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

/* =========================
   PRODUCT PRINT SIDES
========================= */

export const productPrintSidesRelations = relations(
  productPrintSides,
  ({ one }) => ({
    product: one(products, {
      fields: [productPrintSides.productId],
      references: [products.id],
    }),
  }),
);

/* =========================
   PRODUCT SIZES
========================= */

export const productSizesRelations = relations(productSizes, ({ one }) => ({
  product: one(products, {
    fields: [productSizes.productId],
    references: [products.id],
  }),
}));

/* =========================
   PRODUCT COLORS
========================= */

export const productColorsRelations = relations(productColors, ({ one }) => ({
  product: one(products, {
    fields: [productColors.productId],
    references: [products.id],
  }),
}));

/* =========================
   PRODUCT PRICING (1–1)
========================= */

export const productPricingRelations = relations(
  productPricing,
  ({ one }) => ({
    product: one(products, {
      fields: [productPricing.productId],
      references: [products.id],
    }),
  }),
);

/* =========================
   PRODUCT CUSTOMIZATION RULES (1–1)
========================= */

export const productCustomizationRulesRelations = relations(
  productCustomizationRules,
  ({ one }) => ({
    product: one(products, {
      fields: [productCustomizationRules.productId],
      references: [products.id],
    }),
  }),
);

/* =========================
   PRODUCT PRODUCTION (1–1)
========================= */

export const productProductionRelations = relations(
  productProduction,
  ({ one }) => ({
    product: one(products, {
      fields: [productProduction.productId],
      references: [products.id],
    }),
  }),
);

/* =========================
   PRODUCT TEMPLATES
========================= */

export const productTemplatesRelations = relations(
  productTemplates,
  ({ many }) => ({
    products: many(products),
  }),
);
