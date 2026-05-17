/* eslint-disable prettier/prettier */
import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CloudinaryService } from "./cloudinary.service";

@Controller("uploads")
export class UploadController {
  constructor(
      @Inject(CloudinaryService)
      private readonly cloudinary: CloudinaryService,
    ) {}

  @Post("image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.cloudinary.uploadImage(file);
  }
}
