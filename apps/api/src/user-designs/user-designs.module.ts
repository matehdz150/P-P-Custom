import { Module } from "@nestjs/common";
import { UserDesignsController } from "./user-designs.controller";
import { UserDesignsService } from "./user-designs.service";

@Module({
  controllers: [UserDesignsController],
  providers: [UserDesignsService],
  exports: [UserDesignsService],
})
export class UserDesignsModule {}
