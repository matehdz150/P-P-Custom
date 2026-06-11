import { Injectable, Inject } from "@nestjs/common";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {
    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID") || "";
    const secretAccessKey = this.configService.get<string>("AWS_SECRET_ACCESS_KEY") || "";
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";
    this.bucketName = this.configService.get<string>("AWS_S3_BUCKET_NAME") || "";
    const endpoint = this.configService.get<string>("AWS_S3_ENDPOINT");

    const clientConfig: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.s3Client = new S3Client(clientConfig);
  }

  private getPublicUrl(key: string): string {
    const endpoint = this.configService.get<string>("AWS_S3_ENDPOINT");
    if (endpoint) {
      return `${endpoint}/${this.bucketName}/${key}`;
    }
    return `https://${this.bucketName}.s3.${this.configService.get<string>("AWS_REGION") || "us-east-1"}.amazonaws.com/${key}`;
  }

  async uploadImage(file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new Error("Invalid file");
    }

    const extension = file.originalname.split(".").pop() || "png";
    const key = `products/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || "image/png",
    });

    await this.s3Client.send(command);

    return {
      url: this.getPublicUrl(key),
      publicId: key,
    };
  }

  async uploadJson(key: string, data: Record<string, any>): Promise<string> {
    const jsonString = JSON.stringify(data);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: Buffer.from(jsonString),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    return this.getPublicUrl(key);
  }

  async downloadJson(keyOrUrl: string): Promise<Record<string, any>> {
    let key = keyOrUrl;
    if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
      const url = new URL(keyOrUrl);
      const parts = url.pathname.split("/");
      const endpoint = this.configService.get<string>("AWS_S3_ENDPOINT");
      if (endpoint) {
        key = parts.slice(2).join("/");
      } else {
        key = parts.slice(1).join("/");
      }
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const bodyContents = await this.streamToString(response.Body as any);
    return JSON.parse(bodyContents);
  }

  private streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on("data", (chunk: any) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }
}
