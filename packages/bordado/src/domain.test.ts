import assert from "node:assert/strict";
import test from "node:test";
import {
	canTransition,
	EMBROIDERY_PROFILE_V1,
	EMBROIDERY_SCHEMA_VERSION,
	type EmbroideryDesign,
	earlyAnalysis,
	embroideryDesignHash,
	INKSTITCH_ENGINE_VERSION,
	resultMatchesCurrentDesign,
	validateDesign,
} from "./index";

const design = (): EmbroideryDesign => ({
	schemaVersion: EMBROIDERY_SCHEMA_VERSION,
	sourceSnapshotHash: "a".repeat(64),
	productId: "p1",
	sideId: "front",
	physical: { widthMm: 90, heightMm: 60 },
	bounds: { xMm: 4, yMm: 4, widthMm: 20, heightMm: 20 },
	colors: [{ id: "c1", sourceHex: "#111111", displayHex: "#111111", order: 0 }],
	objects: [
		{
			id: "o1",
			sourceObjectId: "fabric-1",
			sourceType: "vector",
			classification: "logo",
			colorId: "c1",
			geometry: { kind: "path", d: "M 4 4 L 24 4 L 24 24 Z" },
			stitch: { type: "fill" },
			bounds: { xMm: 4, yMm: 4, widthMm: 20, heightMm: 20 },
			nodeCount: 3,
		},
	],
	metrics: { componentCount: 1, nodeCount: 3 },
	profileVersion: EMBROIDERY_PROFILE_V1.version,
	engineVersion: INKSTITCH_ENGINE_VERSION,
});

test("hash is deterministic despite key insertion order", async () => {
	const a = design();
	const b = JSON.parse(JSON.stringify(a)) as EmbroideryDesign;
	assert.equal(await embroideryDesignHash(a), await embroideryDesignHash(b));
});
test("relevant changes alter hash", async () => {
	const a = design();
	const b = design();
	b.physical.widthMm = 89;
	assert.notEqual(await embroideryDesignHash(a), await embroideryDesignHash(b));
});
test("state machine only permits explicit transitions", () => {
	assert.equal(canTransition("QUEUED", "PROCESSING"), true);
	assert.equal(canTransition("QUEUED", "READY"), false);
	assert.equal(canTransition("FAILED", "QUEUED"), true);
});
test("profile is versioned and explicitly experimental", () => {
	assert.match(EMBROIDERY_PROFILE_V1.version, /^experimental-v1-/);
	assert.equal(EMBROIDERY_PROFILE_V1.physicallyValidated, false);
});
test("early reject combines complexity signals", () => {
	const d = design();
	d.metrics = {
		componentCount: 2,
		nodeCount: 3,
		texture: 0.8,
		colorEntropy: 7.2,
	};
	assert.equal(earlyAnalysis(d, EMBROIDERY_PROFILE_V1).decision, "reject");
});
test("validation rejects unsafe or external geometry", () => {
	const d = design();
	validateDesign(d);
	d.objects[0].geometry.d = '<image href="https://example.com/a.png" />';
	assert.throws(() => validateDesign(d), /UNSAFE_GEOMETRY/);
});
test("validation rejects claimed bounds outside the physical side", () => {
	const d = design();
	d.objects[0].bounds.xMm = 80;
	assert.throws(() => validateDesign(d), /INVALID_OBJECT_BOUNDS/);
});
test("component limit is derived from actual path subpaths", () => {
	const d = design();
	d.metrics.componentCount = 1;
	d.objects[0].geometry.d = Array.from(
		{ length: EMBROIDERY_PROFILE_V1.limits.maxComponents + 1 },
		(_, index) => `M ${index / 10} 4 L ${index / 10 + 0.01} 4`,
	).join(" ");
	assert.equal(earlyAnalysis(d, EMBROIDERY_PROFILE_V1).decision, "reject");
});
test("old result never replaces current design", () => {
	const result = {
		jobId: "a",
		designHash: "hash-a",
		status: "READY" as const,
		issues: [],
	};
	assert.equal(resultMatchesCurrentDesign("hash-b", result), false);
	assert.equal(resultMatchesCurrentDesign("hash-a", result), true);
});
