import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { canonicalJson } from "@kustto/bordado";
import type {
	EmbroideryJob,
	JobQueue,
	JobRepository,
	ProductRecord,
	ProductRepository,
	SnapshotStore,
} from "./model.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const sqs = new SQSClient({});
const jobsTable =
	process.env.KUSTTO_EMBROIDERY_JOBS_TABLE ?? "kustto-embroidery-jobs";
const mainTable = process.env.KUSTTO_TABLA ?? "kustto-prod";
const bucket = process.env.KUSTTO_EMBROIDERY_BUCKET ?? "";
const queueUrl = process.env.KUSTTO_EMBROIDERY_QUEUE_URL ?? "";

export const awsJobs: JobRepository = {
	async get(jobId) {
		const { Item } = await ddb.send(
			new GetCommand({ TableName: jobsTable, Key: { pk: `JOB#${jobId}` } }),
		);
		return (Item as EmbroideryJob | undefined) ?? null;
	},
	async create(job) {
		try {
			await ddb.send(
				new PutCommand({
					TableName: jobsTable,
					Item: job,
					ConditionExpression: "attribute_not_exists(pk)",
				}),
			);
			return true;
		} catch (e) {
			if ((e as { name?: string }).name === "ConditionalCheckFailedException")
				return false;
			throw e;
		}
	},
	async retry(jobId, ownerId) {
		try {
			await ddb.send(
				new UpdateCommand({
					TableName: jobsTable,
					Key: { pk: `JOB#${jobId}` },
					UpdateExpression: "SET #s=:queued REMOVE errorCode, completedAt",
					ConditionExpression:
						"#s=:failed AND ownerId=:owner AND attempts < :max",
					ExpressionAttributeNames: { "#s": "status" },
					ExpressionAttributeValues: {
						":queued": "QUEUED",
						":failed": "FAILED",
						":owner": ownerId,
						":max": 3,
					},
				}),
			);
			return true;
		} catch (e) {
			if ((e as { name?: string }).name === "ConditionalCheckFailedException")
				return false;
			throw e;
		}
	},
};
export const awsProducts: ProductRepository = {
	async get(productId) {
		const { Item } = await ddb.send(
			new GetCommand({
				TableName: mainTable,
				Key: { pk: `PRODUCT#${productId}`, sk: "META" },
			}),
		);
		return (Item as ProductRecord | undefined) ?? null;
	},
};
export const awsSnapshots: SnapshotStore = {
	async put(key, design) {
		try {
			await s3.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: canonicalJson(design),
					ContentType: "application/json",
					ServerSideEncryption: "AES256",
					IfNoneMatch: "*",
				}),
			);
		} catch (error) {
			if (
				(error as { $metadata?: { httpStatusCode?: number } }).$metadata
					?.httpStatusCode !== 412
			)
				throw error;
		}
	},
	async previewUrl(key) {
		return getSignedUrl(
			s3,
			new GetObjectCommand({ Bucket: bucket, Key: key }),
			{ expiresIn: 300 },
		);
	},
};
export const awsQueue: JobQueue = {
	async send(jobId, designHash) {
		await sqs.send(
			new SendMessageCommand({
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({ jobId, designHash }),
			}),
		);
	},
};
