CREATE TABLE "package_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "package_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "package_category_items" (
	"package_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "package_category_items_package_id_category_id_pk" PRIMARY KEY("package_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "package_category_items" ADD CONSTRAINT "package_category_items_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_category_items" ADD CONSTRAINT "package_category_items_category_id_package_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."package_categories"("id") ON DELETE no action ON UPDATE no action;