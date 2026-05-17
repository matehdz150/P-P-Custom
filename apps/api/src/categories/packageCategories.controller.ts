/* eslint-disable prettier/prettier */
import { Controller, Get, Post, Param, Body, Inject } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CreatePackageCategoryDto } from "./dto/create-packageCategory.dto";

@Controller("package-categories")
export class PackageCategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService
  ) {}

  // ======================
  // PACKAGE CATEGORIES
  // ======================

  @Get()
  findAll() {
    return this.categoriesService.findAllPackageCategories();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.categoriesService.findOnePackageCategory(id);
  }

  @Post()
  create(@Body() dto: CreatePackageCategoryDto) {
    return this.categoriesService.createPackageCategory(dto);
  }

  @Get(":id/packages")
  findPackages(@Param("id") id: string) {
    return this.categoriesService.findPackages(id);
  }

  @Get("by-name/:name")
  findByName(@Param("name") name: string) {
    return this.categoriesService.findPackageCategoryWithPackagesByName(name);
  }
}
