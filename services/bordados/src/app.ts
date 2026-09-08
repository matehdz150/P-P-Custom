import {
	EMBROIDERY_PROFILE_V2,
	type EmbroideryDesign,
	type EmbroideryJobPublic,
	embroideryDesignHash,
	embroideryJobId,
	validateDesign,
} from "@kustto/bordado";
import type {
	EmbroideryJob,
	JobQueue,
	JobRepository,
	ProductRepository,
	SnapshotStore,
} from "./model.js";

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}
export type ApiDeps = {
	jobs: JobRepository;
	products: ProductRepository;
	snapshots: SnapshotStore;
	queue: JobQueue;
	enabled: boolean;
	now?: () => Date;
};

function jobPublic(
	job: EmbroideryJob,
	previewUrl?: string,
): EmbroideryJobPublic {
	return {
		jobId: job.jobId,
		designHash: job.designHash,
		status: job.status,
		decision: job.decision,
		confidence: job.confidence,
		previewUrl,
		issues: job.issues ?? [],
		metrics: job.metrics,
	};
}

export function createEmbroideryApi(deps: ApiDeps) {
	const now = deps.now ?? (() => new Date());
	return {
		async post(ownerId: string, body: unknown) {
			if (!deps.enabled)
				throw new ApiError(404, "Preparación de bordado no disponible");
			const request = (body ?? {}) as { design?: unknown; retry?: boolean };
			try {
				validateDesign(request.design);
			} catch (error) {
				const code = error instanceof Error ? error.message : "INVALID_DESIGN";
				/* Un motivo que el comprador pueda ACCIONAR cuando lo haya.
				   "El diseño de bordado no es válido" no le dice a nadie qué
				   hacer, y en el caso de las medidas la respuesta es concreta: el
				   área de bordado del producto es más grande de lo que la máquina
				   admite, y eso lo arregla el taller, no él. */
				const motivos: Record<string, string> = {
					RASTER_NOT_PREPARED: "Este raster aún no es apto para bordado automático",
					DIMENSIONS_EXCEEDED: `El área de bordado de este producto es más grande de lo que admite el bordado automático (máximo ${EMBROIDERY_PROFILE_V2.limits.maxWidthMm} x ${EMBROIDERY_PROFILE_V2.limits.maxHeightMm} mm).`,
					INVALID_DIMENSIONS: "Las medidas del área de bordado no son válidas.",
					UNSUPPORTED_PROFILE: "Este diseño se preparó con una versión anterior; vuelve a prepararlo.",
					PREPARATION_MISMATCH: "Este diseño se preparó con una versión anterior; vuelve a prepararlo.",
				};
				throw new ApiError(400, motivos[code] ?? "El diseño de bordado no es válido");
			}
			const design = request.design as EmbroideryDesign;
			const product = await deps.products.get(design.productId);
			const side = product?.printSides?.find(
				(candidate) =>
					candidate.sideKey === design.sideId && candidate.enabled !== false,
			);
			if (!product || product.estado !== "activo" || !side)
				throw new ApiError(404, "Producto o lado no disponible");
			if (side.tecnica !== "bordado")
				throw new ApiError(400, "Ese lado no usa técnica de bordado");
			if (
				Math.abs(side.widthCm * 10 - design.physical.widthMm) > 0.05 ||
				Math.abs(side.heightCm * 10 - design.physical.heightMm) > 0.05
			)
				throw new ApiError(400, "Las medidas no coinciden con el producto");

			const designHash = await embroideryDesignHash(design);
			const jobId = await embroideryJobId(ownerId, designHash);
			const existing = await deps.jobs.get(jobId);
			if (existing) {
				if (existing.ownerId !== ownerId)
					throw new ApiError(404, "Job no encontrado");
				if (
					existing.status === "FAILED" &&
					request.retry &&
					existing.attempts < 3
				) {
					if (await deps.jobs.retry(jobId, ownerId)) {
						await deps.queue.send(jobId, designHash);
						console.log(
							JSON.stringify({
								event: "retries",
								jobId,
								designHash,
								attempts: existing.attempts,
							}),
						);
					}
					return {
						statusCode: 202,
						body: jobPublic({
							...existing,
							status: "QUEUED",
							errorCode: undefined,
						}),
					};
				}
				// Reenviar QUEUED repara el hueco si DynamoDB aceptó el job pero SQS
				// falló. Los duplicados son inocuos: el worker adquiere atómicamente.
				if (existing.status === "QUEUED")
					await deps.queue.send(jobId, designHash);
				const previewKey = existing.previewKey;
				return {
					statusCode: 202,
					body: jobPublic(
						existing,
						previewKey &&
							(existing.status === "READY" || existing.status === "REVIEW")
							? await deps.snapshots.previewUrl(previewKey)
							: undefined,
					),
				};
			}

			const inputKey = `inputs/${designHash}/${jobId}/design.json`;
			await deps.snapshots.put(inputKey, design);
			const createdAt = now().toISOString();
			const job: EmbroideryJob = {
				pk: `JOB#${jobId}`,
				jobId,
				designHash,
				ownerId,
				productId: design.productId,
				sideId: design.sideId,
				status: "QUEUED",
				schemaVersion: design.schemaVersion,
				profileVersion: design.profileVersion,
				engineVersion: design.engineVersion,
				widthMm: design.physical.widthMm,
				heightMm: design.physical.heightMm,
				createdAt,
				attempts: 0,
				inputKey,
				expiresAt: Math.floor(now().getTime() / 1000) + 90 * 24 * 3600,
			};
			if (!(await deps.jobs.create(job))) {
				const concurrent = await deps.jobs.get(jobId);
				if (!concurrent) throw new ApiError(409, "No pudimos confirmar el job");
				return {
					statusCode: 202,
					body: jobPublic(concurrent),
				};
			}
			await deps.queue.send(jobId, designHash);
			console.log(JSON.stringify({ event: "jobCreated", jobId, designHash }));
			return { statusCode: 202, body: jobPublic(job) };
		},
		async get(ownerId: string, jobId: string) {
			if (!deps.enabled)
				throw new ApiError(404, "Preparación de bordado no disponible");
			const job = await deps.jobs.get(jobId);
			if (!job || job.ownerId !== ownerId)
				throw new ApiError(404, "Job no encontrado");
			const preview =
				(job.status === "READY" || job.status === "REVIEW") && job.previewKey
					? await deps.snapshots.previewUrl(job.previewKey)
					: undefined;
			return { statusCode: 200, body: jobPublic(job, preview) };
		},
	};
}
