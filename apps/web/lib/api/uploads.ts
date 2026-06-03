import { apiFetch } from "./api";

export type UploadResponse = {
  url: string;
  publicId: string;
};

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/uploads/image`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );

  if (!res.ok) {
    throw new Error("Error subiendo imagen");
  }

  return res.json();
}

export async function uploadImageBlob(
  blob: Blob,
  filename = "image.png",
): Promise<UploadResponse> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  return uploadImage(file);
}