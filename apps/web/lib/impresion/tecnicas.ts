/**
 * Con qué se estampa cada lado, y qué archivo pide.
 *
 * POR QUÉ NO SIRVE EL `technique` QUE YA HABÍA. Ese campo existe desde antes en
 * `lib/api/catalogo.ts`, es texto libre y nunca llegó a capturarse en el alta:
 * está para escribirlo en la ficha del catálogo, no para decidir nada. Esto sí
 * decide —qué archivo se produce—, así que es una lista cerrada. Los dos
 * conviven: aquél es la etiqueta que lee una persona, éste es el dato.
 *
 * VA POR LADO Y NO POR PRODUCTO. Es donde ya viven `dpi` y `sangradoCm`, que
 * son sus vecinos naturales —las tres describen cómo sale el archivo de ese
 * lado— y es el nivel que lee el exportador. Que casi siempre sea la misma en
 * todo el producto no la convierte en un dato del producto: una gorra bordada
 * al frente y estampada atrás existe.
 *
 * LO ÚNICO QUE EL EDITOR CONSULTA ES `salida`. Una serigrafía y una
 * sublimación se mandan igual —un PNG a los DPI declarados—; un láser no
 * imprime, quema, y necesita trazos. Toda la diferencia está en esa palabra, y
 * por eso el resto del código pregunta por ella y no por la técnica: cuando
 * entre una nueva, se clasifica aquí y no se toca nada más.
 */

export type SalidaDeArte = "raster" | "vector";

export const TECNICAS = {
	dtf: { nombre: "DTF / transfer", salida: "raster" },
	serigrafia: { nombre: "Serigrafía", salida: "raster" },
	sublimacion: { nombre: "Sublimación", salida: "raster" },
	uv: { nombre: "Impresión UV", salida: "raster" },
	/**
	 * El láser no imprime: quema. No hay medias tintas ni colores, hay un
	 * recorrido que la máquina sigue, así que lo que se manda son trazos.
	 */
	laser: { nombre: "Grabado láser", salida: "vector" },
	/**
	 * EL BORDADO NO ES NINGUNO DE LOS DOS, y ponerlo en `raster` es una
	 * simplificación consciente. Una bordadora no lee ni PNG ni SVG: lee
	 * archivos de puntada (DST, PES), que salen de digitalizar el diseño a mano
	 * decidiendo dirección y densidad del hilo. Hoy el taller recibe la imagen y
	 * lo digitaliza él, que es exactamente lo que pasaba antes de este campo;
	 * marcarlo como `vector` prometería un archivo que tampoco le sirve.
	 */
	bordado: { nombre: "Bordado", salida: "raster" },
} as const satisfies Record<string, { nombre: string; salida: SalidaDeArte }>;

export type Tecnica = keyof typeof TECNICAS;

export function esTecnica(valor: unknown): valor is Tecnica {
	return typeof valor === "string" && valor in TECNICAS;
}

/** Las técnicas para pintar un selector, en el orden en que están declaradas. */
export const TECNICAS_EN_ORDEN = Object.entries(TECNICAS) as [
	Tecnica,
	(typeof TECNICAS)[Tecnica],
][];

/**
 * Qué archivo pide ese lado.
 *
 * SIN TÉCNICA DECLARADA, RÁSTER. Es lo que han hecho todos los productos hasta
 * hoy, así que el que no se haya vuelto a tocar sigue exportando el PNG de
 * siempre. Un valor que no reconocemos cae en lo mismo antes que romper un
 * pedido: el taller recibe lo que recibía.
 */
export function salidaDelLado(lado?: {
	tecnica?: string | null;
}): SalidaDeArte {
	return esTecnica(lado?.tecnica) ? TECNICAS[lado.tecnica].salida : "raster";
}
