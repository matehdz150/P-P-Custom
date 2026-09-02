import { relations } from "drizzle-orm";
import { categories } from "./categories";
import { productCategories } from "./productCategories";
import { products } from "../products/products";

// 🔥 PIVOT RELATION (OBLIGATORIA)
export const productCategoriesRelations = relations(
	productCategories,
	({ one }) => ({
		product: one(products, {
			fields: [productCategories.productId],
			references: [products.id],
		}),
		category: one(categories, {
			fields: [productCategories.categoryId],
			references: [categories.id],
		}),
	}),
);

// 🔥 CATEGORY → PRODUCT_CATEGORIES
export const categoriesRelations = relations(categories, ({ many }) => ({
	productCategories: many(productCategories),
}));
