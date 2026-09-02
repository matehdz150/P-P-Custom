import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema, type DBSchema } from "../../../../packages/db/schema/schema";

// En Docker DATABASE_URL apunta a postgres://...@postgres:5432; en local
// (sin la variable) cae al default localhost.
const pool = process.env.DATABASE_URL
	? new Pool({ connectionString: process.env.DATABASE_URL })
	: new Pool({
			host: "localhost",
			port: 5432,
			user: "ppcustom",
			password: "ppcustom123",
			database: "ppcustom_db",
		});

export const db = drizzle<DBSchema>(pool, { schema });
