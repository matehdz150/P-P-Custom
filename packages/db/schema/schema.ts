import * as auth from "./auth";
import * as products from "./products";
import * as packages from './packages'
import * as categories from './categories'

export const schema = {
  ...auth,
  ...products,
  ...packages,
  ...categories,
};

export type DBSchema = typeof schema;