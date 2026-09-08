/** Registro foto/modelo. Los límites son la silueta (sin el fondo transparente)
 * de la foto frontal 1312×1199, no el rectángulo del bordado. Otra foto o modelo
 * necesita su propio registro; no se deduce de la vista seleccionada. */
export const REGISTRO_GORRA = {
	foto: "/productos/7458f4e8-6051-70af-cab2-e666d2fa2b4b/e1f194ce4501c534.png",
	/* Ajustada al alto/ancho de esa silueta con el GLB actual (sin deformarlo).
	   RECALIBRADA al cambiar de modelo: la anterior (18.1416°) era del GLB de
	   44 k triángulos. El método —buscar la elevación cuya silueta proyectada
	   tiene la proporción de la foto— reproduce ese valor sobre el modelo viejo
	   (18.1400°), que es lo que da confianza en el nuevo. */
	elevacion: (21.03 * Math.PI) / 180,
	// Eje de la copa: Z del vértice superior del botón en este GLB. El origen
	// de la caja incluye la visera y NO es el centro de la cabeza.
	centroCopaZ: -0.3451671898365021,
	silueta: {
		left: 25 / 1312,
		top: 23 / 1199,
		width: 1260 / 1312,
		height: 1155 / 1199,
	},
};

export type ReferenciaGorra = {
	url: string;
	esquinas: { x: number; y: number }[];
};

export function referenciaDeGorra(
	fotos: { lado: string; url: string; esquinas?: { x: number; y: number }[] }[],
): ReferenciaGorra | undefined {
	const foto = fotos.find(
		(f) =>
			f.lado === "front" &&
			f.url.split(/[?#]/)[0].endsWith(REGISTRO_GORRA.foto),
	);
	if (
		!foto ||
		foto.esquinas?.length !== 4 ||
		!foto.esquinas.every(
			(p) =>
				Number.isFinite(p.x) &&
				Number.isFinite(p.y) &&
				p.x >= 0 &&
				p.x <= 1 &&
				p.y >= 0 &&
				p.y <= 1,
		)
	)
		return undefined;
	return { url: foto.url, esquinas: foto.esquinas.map((p) => ({ ...p })) };
}

/** Coordenadas ortográficas de la cámara de registro, nunca de OrbitControls. */
export function proyectarGorra(x: number, y: number, z: number) {
	return {
		x,
		y:
			y * Math.cos(REGISTRO_GORRA.elevacion) -
			z * Math.sin(REGISTRO_GORRA.elevacion),
	};
}

export type LimitesGorra = { x0: number; x1: number; y0: number; y1: number };

/** La antigua partición del GLB usa nz>=0.5 con cámara horizontal y deja
 * partes de la copa fuera. Con la cámara registrada también son imprimibles
 * las caras exteriores superiores; nunca el reverso ni la cara interior. */
export function superficieFrontalGorra(ny: number, nz: number, z: number) {
	return (
		z > REGISTRO_GORRA.centroCopaZ &&
		nz > 0 &&
		ny * Math.sin(REGISTRO_GORRA.elevacion) +
			nz * Math.cos(REGISTRO_GORRA.elevacion) >
			0.2
	);
}

export function puntoEnFotoGorra(
	p: { x: number; y: number },
	caja: LimitesGorra,
) {
	const s = REGISTRO_GORRA.silueta;
	return {
		x: s.left + ((p.x - caja.x0) / (caja.x1 - caja.x0)) * s.width,
		y: s.top + ((caja.y1 - p.y) / (caja.y1 - caja.y0)) * s.height,
	};
}

/** La homografía inversa conserva TODOS los márgenes y posiciones del arte.
 * El cuarto de textura exterior queda liso: ClampToEdge no repite tinta. */
export function uvDeGorra(p: { x: number; y: number }, inversa: number[]) {
	const m = inversa;
	const w = m[6] * p.x + m[7] * p.y + m[8];
	if (!Number.isFinite(w) || Math.abs(w) < 1e-10) return { u: 0, v: 0 };
	const u = (m[0] * p.x + m[1] * p.y + m[2]) / w;
	const v = (m[3] * p.x + m[4] * p.y + m[5]) / w;
	return { u: 0.25 + u * 0.5, v: 0.75 - v * 0.5 };
}

/**
 * Cuándo un producto se puede enseñar con el modelo 3D de la gorra.
 *
 * Se decide por la FORMA y por los lados, no sólo por el nombre: un producto
 * llamado "gorra" pero con espalda y mangas no es una gorra, y enseñarlo con
 * este modelo sería peor que no enseñar nada.
 *
 * El modelo sólo tiene panel delantero texturizado, así que un producto con
 * más lados imprimibles se queda fuera hasta que los tenga.
 */
export function esGorra3D(product: {
	name: string;
	sides: string[];
	forma?: string;
}) {
	return (
		product.forma !== "cilindro" &&
		product.forma !== "cono" &&
		product.sides.length === 1 &&
		product.sides[0] === "front" &&
		/\b(gorras?|caps?|viseras?)\b/i.test(product.name)
	);
}
