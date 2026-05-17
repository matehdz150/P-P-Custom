/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Inject,
  Query,
} from "@nestjs/common";
import { PackagesService } from "./packages.service";
import { CreatePackageDto } from "./dto/create-packages.dto";
import { UpdatePackageDto } from "./dto/update-packages.dto";

@Controller("packages")
export class PackagesController {
  constructor(
    @Inject(PackagesService)
    private readonly service: PackagesService,
  ) {}

  @Post()
  create(@Body() dto: CreatePackageDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query("category") category?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll({
      category,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}