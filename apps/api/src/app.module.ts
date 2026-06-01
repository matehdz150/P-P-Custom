/* eslint-disable prettier/prettier */
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { UploadsModule } from "./uploads/uploads.module";
import { PackagesModule } from "./packages/packages.module";
import { TemplatesModule } from "./templates/templates.module";
import { CategoriesModule } from "./categories/categories.module";
import { SearchModule } from "./catalog/catalog.module";
import { ProvidersModule } from "./providers/providers.module";
import { UserDesignsModule } from "./user-designs/user-designs.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		DbModule, AuthModule, ProductsModule, UploadsModule, PackagesModule, TemplatesModule, CategoriesModule, SearchModule, ProvidersModule, UserDesignsModule
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
