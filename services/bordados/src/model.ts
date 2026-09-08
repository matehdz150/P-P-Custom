import type {
	EmbroideryDecision,
	EmbroideryDesign,
	EmbroideryIssue,
	EmbroideryMetrics,
	EmbroideryStatus,
} from "@kustto/bordado";

export type EmbroideryJob = {
	pk: string;
	jobId: string;
	designHash: string;
	ownerId: string;
	productId: string;
	sideId: string;
	status: EmbroideryStatus;
	schemaVersion: number;
	profileVersion: string;
	engineVersion: string;
	widthMm: number;
	heightMm: number;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	attempts: number;
	decision?: EmbroideryDecision;
	confidence?: number;
	issues?: EmbroideryIssue[];
	metrics?: EmbroideryMetrics;
	stitchCount?: number;
	colorCount?: number;
	colorChanges?: number;
	jumps?: number;
	trims?: number;
	dstKey?: string;
	previewKey?: string;
	metadataKey?: string;
	inputKey: string;
	hashes?: Record<string, string>;
	errorCode?: string;
	expiresAt: number;
};

export type ProductSide = {
	sideKey: string;
	widthCm: number;
	heightCm: number;
	tecnica?: string;
	enabled?: boolean;
};
export type ProductRecord = {
	id: string;
	estado?: string;
	printSides?: ProductSide[];
};

export interface JobRepository {
	get(jobId: string): Promise<EmbroideryJob | null>;
	create(job: EmbroideryJob): Promise<boolean>;
	retry(jobId: string, ownerId: string): Promise<boolean>;
}
export interface ProductRepository {
	get(productId: string): Promise<ProductRecord | null>;
}
export interface SnapshotStore {
	put(key: string, design: EmbroideryDesign): Promise<void>;
	previewUrl(key: string): Promise<string>;
}
export interface JobQueue {
	send(jobId: string, designHash: string): Promise<void>;
}
