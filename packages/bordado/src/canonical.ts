import type { EmbroideryDesign } from "./types";

function normalizarNumero(value: number): number {
	if (!Number.isFinite(value))
		throw new TypeError("El diseño contiene un número inválido");
	return Object.is(value, -0) ? 0 : value;
}

/** JSON canónico: claves ordenadas, sin undefined y con números finitos. */
export function canonicalJson(value: unknown): string {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string"
	) {
		return JSON.stringify(value);
	}
	if (typeof value === "number") return JSON.stringify(normalizarNumero(value));
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, item]) => item !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
	}
	throw new TypeError("El diseño contiene un valor no serializable");
}

function hex(bytes: ArrayBuffer) {
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function sha256(value: string): Promise<string> {
	return hex(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
	);
}

export async function embroideryDesignHash(
	design: EmbroideryDesign,
): Promise<string> {
	return sha256(canonicalJson(design));
}

export async function embroideryJobId(
	ownerId: string,
	designHash: string,
): Promise<string> {
	return `emb_${(await sha256(`${ownerId}\u0000${designHash}`)).slice(0, 40)}`;
}
