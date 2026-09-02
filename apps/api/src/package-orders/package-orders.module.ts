import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { PackageOrdersController } from "./package-orders.controller";
import { PackageOrdersService } from "./package-orders.service";

@Module({
  imports: [ProvidersModule],
  controllers: [PackageOrdersController],
  providers: [PackageOrdersService],
  exports: [PackageOrdersService],
})
export class PackageOrdersModule {}
