import type { EmbroideryJobPublic } from "./types";

/** Evita que una respuesta tardía de A reemplace el preview del diseño B. */
export function resultMatchesCurrentDesign(
	currentHash: string | null,
	result: EmbroideryJobPublic,
) {
	return currentHash !== null && result.designHash === currentHash;
}
