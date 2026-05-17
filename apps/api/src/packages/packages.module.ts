// apps/api/src/packages/packages.module.ts
import { Module } from "@nestjs/common";
import { PackagesController } from "./packages.controller";
import { PackagesService } from "./packages.service";

@Module({
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService], // 👈 por si luego otros módulos lo usan
})
export class PackagesModule {}
