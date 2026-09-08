"use client";

import type { EmbroideryDesign, EmbroideryJobPublic } from "@kustto/bordado";
import { tokenVigente } from "@/lib/auth/comprador";

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export class EmbroideryApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const token = await tokenVigente();
	if (!token)
		throw new EmbroideryApiError(401, "Inicia sesión para preparar el bordado");
	let response: Response;
	try {
		response = await fetch(`${API}${path}`, {
			...init,
			headers: {
				authorization: `Bearer ${token}`,
				...(init?.body ? { "content-type": "application/json" } : {}),
			},
		});
	} catch {
		throw new EmbroideryApiError(0, "No pudimos conectar con el servidor");
	}
	const data = await response.json().catch(() => ({}));
	if (!response.ok)
		throw new EmbroideryApiError(
			response.status,
			data.message ?? "No pudimos preparar el bordado",
		);
	return data as T;
}

export const createEmbroideryJob = (design: EmbroideryDesign, retry = false) =>
	request<EmbroideryJobPublic>("/bordados/jobs", {
		method: "POST",
		body: JSON.stringify({ design, retry }),
	});

export const getEmbroideryJob = (jobId: string) =>
	request<EmbroideryJobPublic>(`/bordados/jobs/${encodeURIComponent(jobId)}`);
