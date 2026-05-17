/* eslint-disable prettier/prettier */
// apps/api/src/search/search.controller.ts
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchService } from "./catalogo.service";
import { SearchQueryDto } from "./dto/search-query.dto";

@Controller("search")
export class SearchController {
  constructor(
      @Inject(SearchService)
      private readonly searchService: SearchService,
    ) {}

  /**
   * GET /search?q=texto&limit=10
   */
  @Get()
  search(@Query() query: SearchQueryDto) {
    // normalizamos aquí, no en el DTO
    const q = query.q?.trim();
    if (!q) {
      return [];
    }

    const limit =
      // eslint-disable-next-line prettier/prettier
      typeof query.limit === "string"
        ? Number(query.limit)
        : query.limit;
    return this.searchService.search({
      q,
      limit,
    });
  }
}
