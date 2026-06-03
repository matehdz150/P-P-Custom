import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { type DBSchema, schema } from "../../../../packages/db/schema/schema";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
	process.loadEnvFile(envFile);
}

const getDatabaseUrl = () => {
	const environment = (
		process.env.ENVIROMENT ??
		process.env.ENVIRONMENT ??
		""
	).toLowerCase();

	if (environment === "dev") {
		return process.env.DATABASE_URL_DEV;
	}

	return process.env.DATABASE_URL;
};

const databaseUrl = getDatabaseUrl();

const pool = databaseUrl
	? new Pool({ connectionString: databaseUrl })
	: new Pool({
			host: "localhost",
			port: 5432,
			user: "ppcustom",
			password: "ppcustom123",
			database: "ppcustom_db",
		});

export const db = drizzle<DBSchema>(pool, { schema });
