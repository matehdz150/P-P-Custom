import type { NextConfig } from "next";

const ADMIN_API = process.env.KUSTTO_ADMIN_API ?? "";

/**
 * El sitio se publica como export estático en S3 + CloudFront, pero en
 * desarrollo sigue haciendo falta el servidor de Next: el admin vive de un
 * route handler y los mockups se piden por rewrite.
 *
 * Por eso el export se enciende con una variable y no siempre. `pnpm dev`
 * funciona igual que antes; `infra/frontend.sh` es quien la pone.
 */
const exportando = process.env.KUSTTO_EXPORT === "1";

const nextConfig: NextConfig = {
	...(exportando ? { output: "export" as const } : {}),

	/**
	 * El export construye en su propia carpeta.
	 *
	 * Compartir `.next` con el servidor de desarrollo rompía el build: ahí
	 * quedan los tipos que Next genera para CADA ruta, incluidas las del admin
	 * que este build aparta, y la comprobación fallaba con un "Cannot find
	 * name" señalando un archivo que ya no existe. Separarlos también evita
	 * que publicar deje al `pnpm dev` recompilando desde cero.
	 */
	...(exportando ? { distDir: ".next-sitio" } : {}),

	/**
	 * Carpeta por ruta (`/catalogo/index.html`) en vez de `/catalogo.html`.
	 *
	 * Con esto, la función de CloudFront que resuelve las URLs bonitas sólo
	 * tiene que añadir `index.html` al final, sin adivinar si lo que pidieron
	 * es un archivo o una página.
	 */
	trailingSlash: exportando,

	images: {
		remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
		/**
		 * El optimizador de imágenes de Next necesita un servidor, y aquí no
		 * hay ninguno: en el export las imágenes se sirven tal cual.
		 */
		unoptimized: exportando,
	},

	/**
	 * Los mockups se guardan como `/mockups/...` y tienen que servirse desde
	 * el MISMO origen que la app: el teñido de prenda hace getImageData()
	 * sobre ellos, y desde otro origen el canvas queda contaminado y el
	 * teñido se apaga sin decir nada.
	 *
	 * En desarrollo eso lo resuelve este rewrite, que los pide a la API y
	 * esta los lee del bucket con credenciales — el bucket nunca se abre.
	 * En el export NO EXISTEN los rewrites: lo mismo lo hacen dos
	 * comportamientos de CloudFront apuntando al bucket con OAC. Misma ruta
	 * en los dos lados, que es lo único que el navegador nota.
	 */
	async rewrites() {
		if (exportando) return [];

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
