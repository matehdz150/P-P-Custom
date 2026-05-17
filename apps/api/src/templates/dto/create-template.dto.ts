import type { ProductTemplateData } from "../../../../../packages/db/schema";

export type CreateTemplateDto = {
  id: string;
  name: string;
  data: ProductTemplateData;
};
