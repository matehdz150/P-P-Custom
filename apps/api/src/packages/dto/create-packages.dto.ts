export type CreatePackageItemDto = {
  designRequired: boolean;
  productId: string;
  quantity: number;
};

export class CreatePackageDto {
  name!: string;
  description?: string;
  categories?: string[];

  image?: string;

  items!: CreatePackageItemDto[];

  pricing!: {
    basePrice: number;
  };
}
