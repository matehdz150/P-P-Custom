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
		"local"
	).toLowerCase();

	if (environment === "dev") {
		return withConnectionTimeout(getRequiredEnv("DATABASE_URL_DEV"));
	}

	if (environment === "local") {
		return withConnectionTimeout(getRequiredEnv("DATABASE_URL"));
	}

	throw new Error(
		`Invalid ENVIROMENT value "${environment}". Use "dev" or "local".`,
	);
};

export default defineConfig({
	out: "./apps/api/migrations",
	schema: "./packages/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: getDatabaseUrl(),
	},
});
