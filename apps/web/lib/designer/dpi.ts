/**
 * Escribirle la resolución al PNG.
 *
 * POR QUÉ HACE FALTA. `canvas.toDataURL()` no escribe el chunk `pHYs`, que es
 * donde un PNG guarda su resolución física. Sin él, el archivo sólo dice
 * cuántos píxeles tiene, y todo lo que lo abra asume 72 DPI. Comprobado con un
 * arte real de un pedido: 3307 × 4283 px sin `pHYs`, que Photoshop y cualquier
 * RIP interpretan como **116 × 151 cm** en vez de los 28 cm que mide de verdad.
 * El taller lo reescala a ojo, y ahí se pierden las medidas.
 *
 * Es un problema silencioso: el archivo abre bien, se ve bien, y sólo se nota
 * cuando sale la prenda.
 */

/** Un PNG empieza siempre por esta firma. */
const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Pulgadas a metros: el chunk guarda píxeles por METRO, no por pulgada. */
const PULGADAS_POR_METRO = 39.3700787;

/**
 * Tabla del CRC-32 que usa PNG. Se calcula una vez y se reutiliza: hacerlo
 * por cada chunk sería recalcular 256 entradas para escribir nueve bytes.
 */
const TABLA_CRC = (() => {
	const tabla = new Uint32Array(256);

	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		tabla[n] = c >>> 0;
	}

	return tabla;
})();

function crc32(datos: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < datos.length; i++) {
		c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

/** El chunk entero: longitud, tipo, datos y CRC sobre tipo+datos. */
function chunkPhys(dpi: number): Uint8Array {
	const porMetro = Math.round(dpi * PULGADAS_POR_METRO);

	const cuerpo = new Uint8Array(13); // 4 tipo + 9 datos
	const vista = new DataView(cuerpo.buffer);

	cuerpo.set([0x70, 0x48, 0x59, 0x73], 0); // "pHYs"
	vista.setUint32(4, porMetro);
	vista.setUint32(8, porMetro);
	cuerpo[12] = 1; // unidad: 1 = metro

	const chunk = new Uint8Array(21); // 4 longitud + 13 + 4 CRC
	const v = new DataView(chunk.buffer);

	v.setUint32(0, 9); // los datos son 9 bytes; el tipo no cuenta
	chunk.set(cuerpo, 4);
	v.setUint32(17, crc32(cuerpo));

	return chunk;
}

/**
 * Devuelve el mismo PNG con su resolución declarada.
 *
 * El chunk va justo después de `IHDR`, que es donde manda la especificación:
 * `pHYs` tiene que ir antes del primer `IDAT`. Si ya hubiera uno se sustituye,
 * para no dejar dos y que gane el que el lector encuentre primero.
 *
 * Si el archivo no parece un PNG se devuelve tal cual: es preferible mandar el
 * arte sin metadatos a no mandar arte.
 */
export async function conDpi(png: Blob, dpi: number): Promise<Blob> {
	try {
		const bytes = new Uint8Array(await png.arrayBuffer());

		if (!FIRMA.every((b, i) => bytes[i] === b)) return png;

		const trozos: Uint8Array[] = [];
		let i = 8;

		// La firma se copia entera y después se recorre chunk a chunk.
		trozos.push(bytes.subarray(0, 8));

		const vista = new DataView(bytes.buffer, bytes.byteOffset);
		let puesto = false;

		while (i < bytes.length) {
			const largo = vista.getUint32(i);
			const tipo = String.fromCharCode(
				bytes[i + 4],
				bytes[i + 5],
				bytes[i + 6],
				bytes[i + 7],
			);
			const fin = i + 12 + largo;

			// Uno que ya estuviera se descarta: el nuestro es el bueno.
			if (tipo !== "pHYs") trozos.push(bytes.subarray(i, fin));

			if (tipo === "IHDR") {
				trozos.push(chunkPhys(dpi));
				puesto = true;
			}

			i = fin;

			// Después de IDAT ya no hace falta seguir mirando: se copia el resto
			// de una vez.
			if (tipo === "IDAT") {
				trozos.push(bytes.subarray(i));
				break;
			}
		}

		if (!puesto) return png;

		// Se junta todo en un búfer propio en vez de pasar la lista de vistas:
		// así el Blob no queda apuntando a trozos del original.
		const total = trozos.reduce((n, t) => n + t.length, 0);
		const salida = new Uint8Array(total);
		let escrito = 0;

		for (const trozo of trozos) {
			salida.set(trozo, escrito);
			escrito += trozo.length;
		}

		return new Blob([salida.buffer as ArrayBuffer], { type: "image/png" });
	} catch {
		// Un PNG que no se puede reescribir se manda como esté.
		return png;
	}
}
