import { Module } from "@nestjs/common";
import { PackagesModule } from "../packages/packages.module";
import { ProductsModule } from "../products/products.module";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

@Module({
	imports: [ProductsModule, PackagesModule],
	controllers: [ProvidersController],
	providers: [ProvidersService],
	exports: [ProvidersService],
})
export class ProvidersModule {}
