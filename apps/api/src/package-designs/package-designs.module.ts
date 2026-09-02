import { Module } from "@nestjs/common";
import { PackageDesignsController } from "./package-designs.controller";
import { PackageDesignsService } from "./package-designs.service";

@Module({
  controllers: [PackageDesignsController],
  providers: [PackageDesignsService],
  exports: [PackageDesignsService],
})
export class PackageDesignsModule {}
