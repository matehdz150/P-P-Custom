import { correrBanco } from "./banco";

correrBanco().catch((error) => {
	console.error(error);
	process.exit(1);
});
