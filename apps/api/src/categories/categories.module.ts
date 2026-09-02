// categories/categories.module.ts
import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PackageCategoriesController } from "./packageCategories.controller";

@Module({
	controllers: [CategoriesController, PackageCategoriesController],
	providers: [CategoriesService],
	exports: [CategoriesService],
})
export class CategoriesModule {}
