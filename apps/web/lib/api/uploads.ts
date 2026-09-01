import { adminFetch } from "./admin";

export type UploadResponse = {
  url: string;
  publicId: string;
};

/**
 * Subida genérica a Cloudinary. Sigue sirviendo para imágenes que NO entran
 * al canvas del editor. Los mockups van por `subirMockup`.
 */
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

type PermisoSubida = {
  uploadUrl: string;
  path: string;
};

/**
 * Sube un mockup a S3 sin que el archivo pase por la API.
 *
 * Son dos pasos: la API firma un permiso de escritura, y el navegador hace
 * PUT directo contra S3. Así no hay límite de tamaño de API Gateway ni se
 * paga tiempo de Lambda moviendo bytes.
 *
 * Devuelve una RUTA (`/mockups/...`), no una URL de S3, a propósito: los
 * mockups tienen que leerse desde el mismo origen que el sitio o el teñido
 * de prenda se apaga solo — hace getImageData() sobre ellos y con otro
 * origen el canvas queda contaminado. Ver lib/fabric/prenda.ts.
 */
export async function subirMockup(
  file: File,
  destino: { templateId: string; side: string },
): Promise<string> {
  const permiso = await adminFetch<PermisoSubida>("/uploads/mockup-url", {
    method: "POST",
    body: JSON.stringify({
      templateId: destino.templateId,
      side: destino.side,
      contentType: file.type,
    }),
  });

  const res = await fetch(permiso.uploadUrl, {
    method: "PUT",
    // El Content-Type tiene que ser EXACTAMENTE el que se firmó o S3
    // rechaza el PUT con una firma inválida.
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`S3 rechazó la subida (${res.status})`);
  }

  return permiso.path;
}
