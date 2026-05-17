import { Injectable } from "@nestjs/common";
import { db } from "../db/connection";
import { ilike, sql } from "drizzle-orm";

import { products } from "../../../../packages/db";
import { productImages } from "../../../../packages/db";
import { productPricing } from "../../../../packages/db";

import { packages } from "../../../../packages/db/schema";
import { packagePricing } from "../../../../packages/db/schema";

import { SearchQueryDto } from "./dto/search-query.dto";

@Injectable()
export class SearchService {
  async search({ q, limit = 10 }: SearchQueryDto) {
    const term = `%${q}%`;

    /* =====================
       PRODUCTS
    ===================== */

    const productsResults = await db
      .select({
        id: products.id,
        name: products.name,
        image: sql<string | null>`
          (
            SELECT ${productImages.url}
            FROM ${productImages}
            WHERE ${productImages.productId} = ${products.id}
            ORDER BY ${productImages.order}
            LIMIT 1
          )
        `,
        price: productPricing.basePrice,
        type: sql<"product">`'product'`,
      })
      .from(products)
      .leftJoin(
        productPricing,
        sql`${productPricing.productId} = ${products.id}`,
      )
      .where(ilike(products.name, term))
      .limit(limit);

    /* =====================
       PACKAGES
    ===================== */

    const packagesResults = await db
      .select({
        id: packages.id,
        name: packages.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        image: packages.image,
        price: packagePricing.basePrice,
        type: sql<"package">`'package'`,
      })
      .from(packages)
      .leftJoin(
        packagePricing,
        sql`${packagePricing.packageId} = ${packages.id}`,
      )
      .where(ilike(packages.name, term))
      .limit(limit);

    /* =====================
       MERGE
    ===================== */

    return [...productsResults, ...packagesResults];
  }
}
