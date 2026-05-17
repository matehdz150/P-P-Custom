import type { CreatePackageItemDto } from "./create-packages.dto";

export class UpdatePackageDto {
  name?: string;
  description?: string;
  categories?: string[];

  image?: string;

  items?: CreatePackageItemDto[];

  pricing?: {
    basePrice: number;
  };
}
