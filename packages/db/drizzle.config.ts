import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const fromRoot = (...paths: string[]) => resolve(repoRoot, ...paths);

const loadEnvFile = (path: string) => {
	const envFile = fromRoot(path);
	if (existsSync(envFile)) {
		process.loadEnvFile(envFile);
	}
};

loadEnvFile("apps/api/.env");
loadEnvFile(".env");

const getRequiredEnv = (name: string) => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
};

const withConnectionTimeout = (databaseUrl: string) => {
	const url = new URL(databaseUrl);
	url.searchParams.set(
		"connectionTimeoutMillis",
		process.env.DB_CONNECT_TIMEOUT_MS ?? "5000",
	);
	return url.toString();
};

const getDatabaseUrl = () => {
	const environment = (
		process.env.ENVIROMENT ??
		process.env.ENVIRONMENT ??
		""
	).toLowerCase();

	if (environment === "dev") {
		process.env.AWS_ACCESS_KEY_ID ??= getRequiredEnv("AWS_ACCESS_KEY");
		process.env.AWS_SECRET_ACCESS_KEY ??= getRequiredEnv("AWS_SECRET_KEY");

		return withConnectionTimeout(getRequiredEnv("DATABASE_URL_DEV"));
	}

	return withConnectionTimeout(getRequiredEnv("DATABASE_URL"));
};

export default defineConfig({
	out: "./apps/api/migrations",
	schema: "./packages/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: getDatabaseUrl(),
	},
});
