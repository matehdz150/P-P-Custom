import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../../../packages/db/schema";

export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

// exportamos la instancia del ORM con schemas incluidos
export const db = drizzle(pool, { schema });
