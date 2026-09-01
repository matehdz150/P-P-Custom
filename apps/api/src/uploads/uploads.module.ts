import { Module } from "@nestjs/common";
import { UploadController } from "./uploads.controller";
import { CloudinaryService } from "./cloudinary.service";
import { UploadsService } from "./uploads.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [CloudinaryService, UploadsService],
})
export class UploadsModule {}
