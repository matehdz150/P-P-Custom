import { Injectable } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: "dzfq2rxzi",
      api_key: "259347723834415",
      api_secret: "03KzxGqpXsq8rAH8_lHKnp14Fqw",
    });
  }

  async uploadImage(file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new Error("Invalid file");
    }

    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "products",
            resource_type: "image",
          },
          (error, result) => {
            if (error || !result) {
              console.error("Cloudinary error:", error);
              return reject(new Error("Cloudinary upload failed"));
            }

            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        )
        .end(file.buffer);
    });
  }
}
