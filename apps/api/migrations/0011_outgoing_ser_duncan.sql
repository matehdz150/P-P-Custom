ALTER TABLE "package_categories" RENAME COLUMN "slug" TO "description";--> statement-breakpoint
ALTER TABLE "package_categories" DROP CONSTRAINT "package_categories_slug_unique";