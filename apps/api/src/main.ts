/* eslint-disable prettier/prettier */
import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aumentar límite del body para soportar payloads grandes (imágenes base64, JSON del diseño)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use(cookieParser());

  app.enableCors({
    origin: "http://localhost:3000",
    credentials: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 8000;

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}

bootstrap();

