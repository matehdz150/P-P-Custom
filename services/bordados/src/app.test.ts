import assert from "node:assert/strict";
import test from "node:test";
import {
	EMBROIDERY_PROFILE_V1,
	EMBROIDERY_SCHEMA_VERSION,
	type EmbroideryDesign,
	INKSTITCH_ENGINE_VERSION,
} from "@kustto/bordado";
import { createEmbroideryApi } from "./app.js";
import type { EmbroideryJob } from "./model.js";

function fixture(): EmbroideryDesign {
	return {
		schemaVersion: EMBROIDERY_SCHEMA_VERSION,
		sourceSnapshotHash: "b".repeat(64),
		productId: "p1",
		sideId: "front",
		physical: { widthMm: 90, heightMm: 60 },
		bounds: { xMm: 5, yMm: 5, widthMm: 20, heightMm: 20 },
		colors: [
			{ id: "c1", sourceHex: "#111111", displayHex: "#111111", order: 0 },
		],
		objects: [
			{
				id: "o1",
				sourceObjectId: "o1",
				sourceType: "vector",
				classification: "logo",
				colorId: "c1",
				geometry: { kind: "path", d: "M5 5 L25 5 L25 25 Z" },
				stitch: { type: "fill" },
				bounds: { xMm: 5, yMm: 5, widthMm: 20, heightMm: 20 },
				nodeCount: 3,
			},
		],
		metrics: { componentCount: 1, nodeCount: 3 },
		profileVersion: EMBROIDERY_PROFILE_V1.version,
		engineVersion: INKSTITCH_ENGINE_VERSION,
	};
}

test("POST creates once, returns 202, and GET is owner-only", async () => {
	const records = new Map<string, EmbroideryJob>();
	const messages: unknown[] = [];
	const api = createEmbroideryApi({
		enabled: true,
		products: {
			async get() {
				return {
					id: "p1",
					estado: "activo",
					printSides: [
						{ sideKey: "front", widthCm: 9, heightCm: 6, tecnica: "bordado" },
					],
				};
			},
		},
		snapshots: {
			async put() {},
			async previewUrl() {
				return "signed";
			},
		},
		queue: {
			async send(jobId, designHash) {
				messages.push({ jobId, designHash });
			},
		},
		jobs: {
			async get(id) {
				return records.get(id) ?? null;
			},
			async create(job) {
				if (records.has(job.jobId)) return false;
				records.set(job.jobId, job);
				return true;
			},
			async retry() {
				return false;
			},
		},
	});
	const first = await api.post("owner-a", { design: fixture() });
	const second = await api.post("owner-a", { design: fixture() });
	assert.equal(first.statusCode, 202);
	assert.equal(second.body.jobId, first.body.jobId);
	assert.equal(messages.length, 2);
	const ready = records.get(first.body.jobId);
	assert.ok(ready);
	ready.status = "READY";
	ready.previewKey = "embroidery/hash/job/preview.png";
	const reused = await api.post("owner-a", { design: fixture() });
	assert.equal(reused.body.status, "READY");
	assert.equal(reused.body.previewUrl, "signed");
	assert.equal(messages.length, 2);
	await assert.rejects(
		api.get("owner-b", first.body.jobId),
		/Job no encontrado/,
	);
});
