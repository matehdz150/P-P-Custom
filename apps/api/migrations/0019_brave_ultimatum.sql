CREATE TABLE "package_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"design_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"design_snapshot" jsonb,
	"design_assets" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "package_order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"note" text,
	"changed_by" varchar(20) DEFAULT 'provider' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "package_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"package_design_id" uuid,
	"provider_id" uuid,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"total_price" varchar(20),
	"notes" text,
	"provider_note" text,
	"shipping_address" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_designs" ADD COLUMN "design_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "user_designs" ADD COLUMN "design_assets" jsonb;--> statement-breakpoint
ALTER TABLE "package_order_items" ADD CONSTRAINT "package_order_items_package_order_id_package_orders_id_fk" FOREIGN KEY ("package_order_id") REFERENCES "public"."package_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_order_items" ADD CONSTRAINT "package_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_order_items" ADD CONSTRAINT "package_order_items_design_id_user_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."user_designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_order_status_history" ADD CONSTRAINT "package_order_status_history_package_order_id_package_orders_id_fk" FOREIGN KEY ("package_order_id") REFERENCES "public"."package_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_package_design_id_package_designs_id_fk" FOREIGN KEY ("package_design_id") REFERENCES "public"."package_designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;