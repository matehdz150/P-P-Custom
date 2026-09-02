CREATE TABLE "package_design_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_design_id" uuid NOT NULL,
	"package_item_id" uuid NOT NULL,
	"unit_index" integer NOT NULL,
	"design_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "package_design_units_unique" UNIQUE("package_design_id","package_item_id","unit_index")
);
--> statement-breakpoint
CREATE TABLE "package_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "package_design_units" ADD CONSTRAINT "package_design_units_package_design_id_package_designs_id_fk" FOREIGN KEY ("package_design_id") REFERENCES "public"."package_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_design_units" ADD CONSTRAINT "package_design_units_package_item_id_package_items_id_fk" FOREIGN KEY ("package_item_id") REFERENCES "public"."package_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_design_units" ADD CONSTRAINT "package_design_units_design_id_user_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."user_designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_designs" ADD CONSTRAINT "package_designs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_designs" ADD CONSTRAINT "package_designs_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;