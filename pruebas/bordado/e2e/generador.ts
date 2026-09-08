/**
 * Genera los siete diseños del E2E dentro del navegador.
 *
 * Corre con el pipeline real y sin atajos: las imágenes se decodifican con
 * `createImageBitmap`, se pintan sobre la rejilla física igual que hace
 * `capturar()` con un objeto de Fabric, y el texto se rasteriza con el mismo
 * `OffscreenCanvas` que usaría el editor.
 */

import {
	canonicalJson,
	EMBROIDERY_PROFILE_V2,
	embroideryDesignHash,
	sha256,
} from "@kustto/bordado";
import { BordadoRechazado, preparar } from "@/lib/bordado/preparar";
import type { FuenteCapturada } from "@/lib/bordado/protocolo";
import { lienzoEnMm } from "@/lib/bordado/rejilla";

declare const __IMAGENES__: Record<string, string>;

const ANCHO_MM = 90;
const ALTO_MM = 50;

async function fuenteRaster(nombre: string): Promise<FuenteCapturada> {
	const respuesta = await fetch(__IMAGENES__[nombre]);
	const bitmap = await createImageBitmap(await respuesta.blob());

	const lienzo = lienzoEnMm(ANCHO_MM, ALTO_MM);
	// La imagen se encaja en el área conservando su proporción, que es lo que
	// hace el editor cuando el comprador suelta un archivo dentro del recuadro.
	const escala = Math.min(
		ANCHO_MM / bitmap.width,
		ALTO_MM / bitmap.height,
	);
	const w = bitmap.width * escala;
	const h = bitmap.height * escala;
	lienzo.ctx.drawImage(
		bitmap,
		(ANCHO_MM - w) / 2,
		(ALTO_MM - h) / 2,
		w,
		h,
	);
	lienzo.ctx.setTransform(1, 0, 0, 1, 0, 0);
	const imagen = lienzo.ctx.getImageData(0, 0, lienzo.ancho, lienzo.alto);

	return {
		tipo: "raster",
		sourceObjectId: nombre,
		datos: imagen.data,
		ancho: lienzo.ancho,
		alto: lienzo.alto,
		mmPorPx: lienzo.mmPorPx,
		desplazamientoMm: lienzo.desplazamientoMm,
	};
}

/**
 * Un "wordmark" de geometría conocida, en milímetros.
 *
 * No imita una tipografía: son astas de grosor medido, para poder comprobar
 * después que salieron como columnas satin del ancho esperado. Una fuente real
 * daría otro grosor en cada máquina y la comprobación no querría decir nada.
 */
function fuenteTexto(alturaMm: number): FuenteCapturada {
	const asta = alturaMm * 0.16;
	const y0 = (ALTO_MM - alturaMm) / 2;
	const partes: string[] = [];
	const barra = (x: number, y: number, w: number, h: number) =>
		`M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}z`;

	let x = 6;
	for (let i = 0; i < 5; i++) {
		partes.push(barra(x, y0, asta, alturaMm));
		partes.push(barra(x + asta * 2.6, y0, asta, alturaMm));
		// Travesaño a media altura: convierte cada par en una "H" y obliga a que
		// la descomposición en columnas se ejercite de verdad.
		partes.push(
			barra(x + asta, y0 + alturaMm / 2 - asta / 2, asta * 1.6, asta),
		);
		x += asta * 4.4;
	}
	return {
		tipo: "texto",
		sourceObjectId: "wordmark",
		d: partes.join(""),
		colorHex: "#111111",
	};
}

const CASOS: Array<{
	nombre: string;
	espera: string;
	fuentes: () => Promise<FuenteCapturada[]>;
}> = [
	{
		nombre: "01-texto-simple",
		espera: "columnas satin de un texto grande",
		fuentes: async () => [fuenteTexto(22)],
	},
	{
		nombre: "02-logo-monocromo",
		espera: "dos tintas",
		fuentes: async () => [await fuenteRaster("logo-bn-simple.png")],
	},
	{
		nombre: "03-logo-multicolor",
		espera: "tres tintas planas",
		fuentes: async () => [await fuenteRaster("logo-multicolor.png")],
	},
	{
		nombre: "04-discovery",
		espera: "REVIEW, nunca PHOTO, geometria preservada",
		fuentes: async () => [await fuenteRaster("real-01-logo-color-alpha.png")],
	},
	{
		nombre: "05-ilustracion",
		espera: "REVIEW",
		fuentes: async () => [await fuenteRaster("ilustracion-media.png")],
	},
	{
		nombre: "06-fotografia",
		espera: "rechazo local: no debe llegar al motor",
		fuentes: async () => [await fuenteRaster("real-07-retrato.jpg")],
	},
	{
		nombre: "07-posterizada",
		espera: "presupuesto agotado: acotado",
		fuentes: async () => [await fuenteRaster("ambiguo-posterizada-8.png")],
	},
	{
		/* El mismo texto un poco más pequeño: sirve para la prueba de que un
		   cambio relevante produce OTRO designHash. */
		nombre: "08-texto-variante",
		espera: "variante para comprobar que el hash cambia",
		fuentes: async () => [fuenteTexto(18)],
	},
];

async function main() {
	const salida: Record<string, unknown> = {};

	for (const caso of CASOS) {
		const desde = performance.now();
		try {
			const fuentes = await caso.fuentes();
			const solicitud = {
				revision: 1,
				productId: "PENDIENTE",
				sideId: "front",
				widthMm: ANCHO_MM,
				heightMm: ALTO_MM,
				sourceSnapshotHash: await sha256(
					canonicalJson({ caso: caso.nombre, w: ANCHO_MM, h: ALTO_MM }),
				),
				fuentes,
			};
			const { design, tiempos } = preparar(solicitud);
			salida[caso.nombre] = {
				espera: caso.espera,
				preparado: true,
				design,
				designHash: await embroideryDesignHash(design),
				msLocal: performance.now() - desde,
				tiempos,
			};
		} catch (error) {
			salida[caso.nombre] = {
				espera: caso.espera,
				preparado: false,
				motivo:
					error instanceof BordadoRechazado
						? error.incidencias.map((i) => i.code).join(",")
						: String((error as Error).message),
				msLocal: performance.now() - desde,
			};
		}
	}

	(window as unknown as { __disenos: unknown }).__disenos = {
		profileVersion: EMBROIDERY_PROFILE_V2.version,
		casos: salida,
	};
	const estado = document.getElementById("estado");
	if (estado) estado.textContent = "listo";
}

main().catch((error) => {
	(window as unknown as { __disenos: unknown }).__disenos = {
		error: String(error?.message ?? error),
	};
});
