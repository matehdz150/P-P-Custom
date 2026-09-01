/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";

import { CloudinaryService } from "./cloudinary.service";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadController {
  constructor(
    @Inject(CloudinaryService)
    private readonly cloudinary: CloudinaryService,
    @Inject(UploadsService)
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Permiso para subir un mockup directo a S3. El archivo no pasa por aquí:
   * el navegador hace PUT contra la URL que devolvemos.
   */
  @Post("mockup-url")
  urlParaMockup(
    @Body() body: { templateId: string; side: string; contentType: string },
  ) {
    return this.uploads.urlParaMockup(body);
  }

  /**
   * Sirve mockups en desarrollo, detrás del rewrite de Next, para que
   * `/mockups/...` sea del mismo origen que la app. En producción lo sirve
   * CloudFront y esto no se invoca.
   */
  @Get("publico/*ruta")
  async servirPublico(@Param("ruta") ruta: string[], @Res() res: Response) {
    const key = Array.isArray(ruta) ? ruta.join("/") : ruta;
    const { cuerpo, contentType } = await this.uploads.leerPublico(key);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    cuerpo.pipe(res);
  }

  /**
   * Subida genérica a Cloudinary. Sigue viva para las imágenes que NO entran
   * al canvas del editor; los mockups ya no pasan por aquí.
   */
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
