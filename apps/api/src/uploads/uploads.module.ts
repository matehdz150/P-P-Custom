import { Module } from "@nestjs/common";
import { UploadController } from "./uploads.controller";
import { CloudinaryService } from "./cloudinary.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [CloudinaryService],
})
export class UploadsModule {}
