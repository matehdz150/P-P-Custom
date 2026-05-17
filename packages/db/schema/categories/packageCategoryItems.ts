import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { packages } from "../packages/packages";
import { packageCategories } from "./packageCategories";

export const packageCategoryItems = pgTable(
  "package_category_items",
  {
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => packageCategories.id),
  },
  (t) => ({
    pk: primaryKey(t.packageId, t.categoryId),
  })
);