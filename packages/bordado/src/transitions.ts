import type { EmbroideryStatus } from "./types";

const ALLOWED: Record<EmbroideryStatus, readonly EmbroideryStatus[]> = {
	QUEUED: ["PROCESSING"],
	PROCESSING: ["READY", "REVIEW", "REJECTED", "FAILED"],
	READY: [],
	REVIEW: [],
	REJECTED: [],
	FAILED: ["QUEUED"],
};

export function canTransition(from: EmbroideryStatus, to: EmbroideryStatus) {
	return ALLOWED[from].includes(to);
}

export function assertTransition(from: EmbroideryStatus, to: EmbroideryStatus) {
	if (!canTransition(from, to))
		throw new Error(`Transición de bordado inválida: ${from} -> ${to}`);
}
