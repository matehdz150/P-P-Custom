import { Module } from "@nestjs/common";
import { UserDesignsController } from "./user-designs.controller";
import { UserDesignsService } from "./user-designs.service";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [UploadsModule],
  controllers: [UserDesignsController],
  providers: [UserDesignsService],
  exports: [UserDesignsService],
})
export class UserDesignsModule {}
