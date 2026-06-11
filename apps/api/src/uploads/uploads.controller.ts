import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { S3Service } from "./s3.service";

@Controller("uploads")
export class UploadController {
  constructor(
    @Inject(S3Service)
    private readonly s3Service: S3Service,
  ) {}

  @Post("image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.s3Service.uploadImage(file);
  }
}
