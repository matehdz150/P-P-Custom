// apps/api/src/search/search.module.ts
import { Module } from "@nestjs/common";
import { SearchController } from "./catalog.controller";
import { SearchService } from "./catalogo.service";

@Module({
	controllers: [SearchController],
	providers: [SearchService],
})
export class SearchModule {}
