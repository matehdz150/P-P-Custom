ALTER TABLE "product_sizes" ALTER COLUMN "size" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "product_sizes" ADD COLUMN "width_in" numeric(5, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "product_sizes" ADD COLUMN "length_in" numeric(5, 2) NOT NULL;