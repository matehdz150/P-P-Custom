import { ApiError, createEmbroideryApi } from "./app.js";
import { awsJobs, awsProducts, awsQueue, awsSnapshots } from "./aws.js";

const api = createEmbroideryApi({
	jobs: awsJobs,
	products: awsProducts,
	snapshots: awsSnapshots,
	queue: awsQueue,
	enabled: process.env.KUSTTO_EMBROIDERY_ENABLED === "true",
});
const cors = {
	"access-control-allow-origin": process.env.KUSTTO_ORIGEN ?? "*",
	"access-control-allow-headers": "content-type,authorization",
	"access-control-allow-methods": "GET,POST,OPTIONS",
	"content-type": "application/json; charset=utf-8",
};
const response = (statusCode: number, body: unknown) => ({
	statusCode,
	headers: cors,
	body: JSON.stringify(body),
});

type ApiGatewayEvent = {
	requestContext?: {
		http?: { method?: string; path?: string };
		authorizer?: { jwt?: { claims?: Record<string, unknown> } };
	};
	body?: string | null;
	isBase64Encoded?: boolean;
};

export async function handler(event: ApiGatewayEvent) {
	if (event?.requestContext?.http?.method === "OPTIONS")
		return response(204, null);
	try {
		const claims = event?.requestContext?.authorizer?.jwt?.claims;
		if (!claims?.sub) throw new ApiError(401, "No autorizado");
		const method = String(event?.requestContext?.http?.method ?? "GET");
		const path = String(event?.requestContext?.http?.path ?? "/");
		if (method === "POST" && path === "/bordados/jobs") {
			const raw = event?.isBase64Encoded
				? Buffer.from(event.body ?? "", "base64").toString("utf8")
				: String(event.body ?? "");
			if (Buffer.byteLength(raw) > 750_000)
				throw new ApiError(413, "El diseño excede el límite permitido");
			const result = await api.post(
				String(claims.sub),
				raw ? JSON.parse(raw) : {},
			);
			return response(result.statusCode, result.body);
		}
		const match =
			method === "GET"
				? path.match(/^\/bordados\/jobs\/([A-Za-z0-9_-]+)$/)
				: null;
		if (match) {
			const result = await api.get(String(claims.sub), match[1]);
			return response(result.statusCode, result.body);
		}
		return response(404, { message: "Ruta no encontrada" });
	} catch (error) {
		if (error instanceof SyntaxError)
			return response(400, { message: "JSON inválido" });
		if (error instanceof ApiError)
			return response(error.status, { message: error.message });
		console.error(
			JSON.stringify({
				event: "apiFailed",
				error: error instanceof Error ? error.name : "unknown",
			}),
		);
		return response(500, { message: "Error interno" });
	}
}
