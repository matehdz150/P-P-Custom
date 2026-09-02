/**
 * El diseño terminado, en tránsito del editor a la pantalla de pedido.
 *
 * POR QUÉ EXISTE ESTO. El diseño vive dentro de un lienzo de Fabric, que es un
 * objeto del navegador atado a la página del editor. Al navegar a otra ruta el
 * lienzo se desmonta y el diseño deja de existir. Como la salida del editor ya
 * no es un modal encima del mismo lienzo sino una pantalla aparte, el arte hay
 * que exportarlo ANTES de salir y llevarlo a cuestas.
 *
 * POR QUÉ INDEXEDDB Y NO `sessionStorage`. Lo que se lleva son PNG de
 * producción a 300 DPI: varios megabytes. `sessionStorage` guarda cadenas y
 * ronda los 5 MB, así que habría que pasarlos a base64 —un tercio más grandes—
 * para reventar el cupo con dos lados dibujados. IndexedDB guarda `Blob` tal
 * cual y aguanta que alguien recargue la pantalla de pedido a medio capturar
 * su dirección, que es justo cuando perder el diseño más dolería.
 */

const BASE = "kustto-pedido";
const ALMACEN = "borrador";
const CLAVE = "actual";

/**
 * Cuánto vale un borrador. Pasado eso se tira: es el diseño de alguien que se
 * fue a otra cosa, y resucitárselo días después sería más confuso que útil.
 */
const VIGENCIA_MS = 6 * 60 * 60 * 1000;

/**
 * Todo lo de un lado dibujado.
 *
 * Son DOS archivos por lado y no uno, porque resuelven cosas distintas:
 *
 * - `arte` es el que va a máquina: recortado al área imprimible, transparente
 *   y a los DPI que declaró el taller.
 * - `colocacion` es la prenda con el diseño encima. No se imprime; es para
 *   comprobar DÓNDE va. El de producción va recortado y no dice en qué parte
 *   de la playera cae.
 *
 * Las miniaturas son data URLs para pintarlas sin cargar el PNG de producción,
 * que pesa megabytes.
 */
export type ArchivoDeLado = {
	lado: string;
	arte: Blob;
	colocacion: Blob | null;
	/** El arte solo, en pequeño. */
	miniaturaArte: string | null;
	/** La prenda con el diseño, en pequeño. Es el mismo píxel que `colocacion`. */
	miniaturaPrenda: string | null;
	/** Lo que mide el archivo de producción, ya con su resolución escrita. */
	anchoPx: number;
	altoPx: number;
	dpi: number;
};

export type BorradorPedido = {
	productoId: string;
	colorPrenda: string | null;
	/** Un elemento por lado con diseño, en el orden en que se dibujaron. */
	lados: ArchivoDeLado[];
	/**
	 * Lo que dibujó el cliente en cada lado, listo para reponerlo si vuelve al
	 * editor.
	 *
	 * Son SÓLO sus objetos, no el lienzo entero: las guías del área imprimible
	 * las crea el editor al montarse, y guardarlas aquí las duplicaría al
	 * restaurar —dos recuadros, uno encima del otro, y el segundo contando como
	 * diseño del cliente—.
	 */
	diseno: Record<string, object[]>;
	creadoEn: number;
};

function abrir(): Promise<IDBDatabase> {
	return new Promise((resolver, rechazar) => {
		const peticion = indexedDB.open(BASE, 1);

		peticion.onupgradeneeded = () => {
			const db = peticion.result;
			if (!db.objectStoreNames.contains(ALMACEN)) {
				db.createObjectStore(ALMACEN);
			}
		};

		peticion.onsuccess = () => resolver(peticion.result);
		peticion.onerror = () => rechazar(peticion.error);
	});
}

export async function guardarBorrador(borrador: BorradorPedido): Promise<void> {
	const db = await abrir();

	try {
		await new Promise<void>((resolver, rechazar) => {
			const tx = db.transaction(ALMACEN, "readwrite");
			tx.objectStore(ALMACEN).put(borrador, CLAVE);
			tx.oncomplete = () => resolver();
			tx.onerror = () => rechazar(tx.error);
		});
	} finally {
		db.close();
	}
}

/**
 * Devuelve el borrador, o `null` si no hay o ya venció.
 *
 * Nunca lanza: si el navegador tiene IndexedDB bloqueado —modo privado de
 * algunos, almacenamiento deshabilitado— la pantalla de pedido tiene que poder
 * decir "vuelve al editor" en vez de romperse con un error del que nadie
 * puede hacer nada.
 */
export async function leerBorrador(): Promise<BorradorPedido | null> {
	try {
		const db = await abrir();

		try {
			const borrador = await new Promise<BorradorPedido | undefined>(
				(resolver, rechazar) => {
					const tx = db.transaction(ALMACEN, "readonly");
					const peticion = tx.objectStore(ALMACEN).get(CLAVE);
					peticion.onsuccess = () => resolver(peticion.result);
					peticion.onerror = () => rechazar(peticion.error);
				},
			);

			if (!borrador) return null;
			if (Date.now() - borrador.creadoEn > VIGENCIA_MS) {
				await borrarBorrador();
				return null;
			}

			return borrador;
		} finally {
			db.close();
		}
	} catch {
		return null;
	}
}

/**
 * Tira el borrador.
 *
 * Se llama cuando el pedido ya se creó: dejarlo ahí haría que volver a
 * `/pedir` reviviera un diseño ya pedido y alguien lo mandara dos veces.
 */
export async function borrarBorrador(): Promise<void> {
	try {
		const db = await abrir();

		try {
			await new Promise<void>((resolver, rechazar) => {
				const tx = db.transaction(ALMACEN, "readwrite");
				tx.objectStore(ALMACEN).delete(CLAVE);
				tx.oncomplete = () => resolver();
				tx.onerror = () => rechazar(tx.error);
			});
		} finally {
			db.close();
		}
	} catch {
		// Que no se pueda borrar no debería impedirle a nadie ver su pedido.
	}
}
