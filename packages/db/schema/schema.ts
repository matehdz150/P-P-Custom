import * as auth from "./auth";
import * as products from "./products";
import * as packages from './packages'
import * as categories from './categories'
import * as userDesigns from "./user_designs";
import * as orders from "./orders";

export const schema = {
  ...auth,
  ...products,
  ...packages,
  ...categories,
  ...userDesigns,
  ...orders,
};

export type DBSchema = typeof schema;