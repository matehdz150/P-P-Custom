import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

@Module({
	imports: [ProductsModule],
	controllers: [ProvidersController],
	providers: [ProvidersService],
	exports: [ProvidersService],
})
export class ProvidersModule {}
