import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

/* =========================
   TYPES (shared)
========================= */

export type EditableArea = {
  id: string;
  type: "rect";
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ProductTemplateData = {
  sides: string[];

  sideLabels: Record<string, string>;
  mockups: Record<string, string>;

  editableAreas: Record<string, EditableArea[]>;
};

/* =========================
   TABLE
========================= */

export const productTemplates = pgTable("product_templates", {
  id: varchar("id", { length: 50 }).primaryKey(), // tshirt, hoodie, etc

  name: varchar("name", { length: 100 }).notNull(),

  data: jsonb("data")
    .$type<ProductTemplateData>()
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});