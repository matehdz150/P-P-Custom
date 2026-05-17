import type { ProductTemplateData } from "../../../../../packages/db/schema";

export type UpdateTemplateDto = {
  name?: string;
  data?: ProductTemplateData;
};
