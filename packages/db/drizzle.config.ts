import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./migrations",
	schema: "./packages/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: (() => {
			const databaseUrl = process.env.DATABASE_URL;
			if (!databaseUrl) {
				throw new Error("DATABASE_URL is not set");
			}
			return databaseUrl;
		})(),
	},
});
