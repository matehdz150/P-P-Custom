import type { NextConfig } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ADMIN_API = process.env.KUSTTO_ADMIN_API ?? "";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
	},

	/**
	 * Los mockups se guardan como `/mockups/...` y tienen que servirse desde
	 * el MISMO origen que la app: el teñido de prenda hace getImageData()
	 * sobre ellos, y desde otro origen el canvas queda contaminado y el
	 * teñido se apaga sin decir nada.
	 *
	 * En desarrollo eso lo resuelve este rewrite, que los pide a la API y
	 * esta los lee del bucket con credenciales — el bucket nunca se abre.
	 * En producción no interviene nadie: CloudFront mapea /mockups/* al
	 * bucket con OAC. Misma ruta en los dos lados.
	 */
	async rewrites() {
		return [
			{
				source: "/mockups/:ruta*",
				destination: `${ADMIN_API}/publico/mockups/:ruta*`,
			},
			// Las imágenes del catálogo que no son mockups (la foto de una
			// categoría, por ejemplo). Mismo bucket cerrado, misma razón para
			// servirlas desde nuestro origen: una sola ruta en dev y en producción.
			{
				source: "/medios/:ruta*",
				destination: `${ADMIN_API}/publico/medios/:ruta*`,
			},
		];
	},
};

export default nextConfig;
