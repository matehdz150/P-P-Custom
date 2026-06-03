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
		"local"
	).toLowerCase();

	if (environment === "dev") {
		if (!process.env.DATABASE_URL_DEV) {
			throw new Error("DATABASE_URL_DEV is not set");
		}
		return process.env.DATABASE_URL_DEV;
	}

	if (environment === "local") {
		if (!process.env.DATABASE_URL) {
			throw new Error("DATABASE_URL is not set");
		}
		return process.env.DATABASE_URL;
	}

	throw new Error(
		`Invalid ENVIROMENT value "${environment}". Use "dev" or "local".`,
	);
};

const databaseUrl = getDatabaseUrl();

const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle<DBSchema>(pool, { schema });
