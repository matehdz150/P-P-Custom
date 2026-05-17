import { relations } from "drizzle-orm";
import { packages } from "./packages";
import { packagePricing } from "./packages_pricing";
import { packageItems } from "./package_items";
import { products } from "../products";

export const packagesRelations = relations(packages, ({ many, one }) => ({
  items: many(packageItems),
  pricing: one(packagePricing),
}));

export const packageItemsRelations = relations(packageItems, ({ one }) => ({
  package: one(packages, {
    fields: [packageItems.packageId],
    references: [packages.id],
  }),
  product: one(products, {
    fields: [packageItems.productId],
    references: [products.id],
  }),
}));

export const packagePricingRelations = relations(packagePricing, ({ one }) => ({
  package: one(packages, {
    fields: [packagePricing.packageId],
    references: [packages.id],
  }),
}));