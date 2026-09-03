/**
 * Abrir en el editor un diseño que ya se hizo.
 *
 * PARA QUÉ. Volver a pedir lo mismo con otras tallas, o repetir el logo de cada
 * mes. Hasta ahora el editor sólo sabía restaurar el borrador local
 * (`borrador.ts`, IndexedDB, seis horas, un solo navegador). Un diseño de un
 * pedido —o uno guardado con nombre— vive en S3 y no había forma de abrirlo.
 *
 * MISMA FORMA QUE EL BORRADOR. Lo que se subió al pedir es exactamente
 * `borrador.diseno`: un objeto de lado -> objetos del cliente, sin las guías
 * del área imprimible, que las crea el editor al montarse. Por eso aquí no hay
 * que traducir nada — y por eso tampoco se duplican los recuadros al restaurar.
 */

/** Lado -> los objetos que dibujó el cliente. */
export type DisenoPorLado = Record<string, object[]>;

/**
 * De dónde se puede cargar un diseño.
 *
 * SÓLO rutas nuestras bajo `/medios/`, y es una comprobación de seguridad, no
 * una comodidad: la ruta llega en la URL, así que cualquiera puede escribir
 * `?diseno=https://…` y hacer que el navegador de otra persona traiga un JSON
 * de donde sea. Con la lista blanca, lo peor que se consigue es abrir un
 * diseño que no es tuyo, que ya es público por su ruta.
 */
const PERMITIDO = /^\/medios\/[A-Za-z0-9._\-/]+\.json$/;

export function rutaDeDisenoValida(ruta: string | null | undefined) {
	if (typeof ruta !== "string" || !PERMITIDO.test(ruta)) return false;

	// `..` aparte, porque el patrón de arriba admite el punto —los nombres de
	// archivo lo llevan— y `/medios/../../otra/cosa.json` calzaría. El navegador
	// lo normalizaría ANTES de pedirlo, así que la comprobación de prefijo se
	// habría hecho sobre una ruta que no es la que se va a buscar.
	return !ruta.split("/").includes("..");
}

/**
 * Lo ya pedido, por ruta.
 *
 * NO es optimización prematura: el efecto que monta el lienzo se re-ejecuta
 * varias veces —modo estricto, y una vez por lado— y se midió que pedía el
 * mismo JSON **seis veces** al abrir una gorra de un solo lado. Con el
 * borrador eso era gratis porque salía de IndexedDB; con un `fetch` no.
 *
 * Se guarda la PROMESA y no el resultado, para que dos montajes a la vez
 * compartan la misma petición en vez de lanzar dos.
 */
const enCurso = new Map<string, Promise<DisenoPorLado | null>>();

/**
 * Trae el diseño. Devuelve `null` si no se puede, nunca lanza.
 *
 * Un diseño que no carga NO puede impedir diseñar: el editor tiene que abrir
 * igual, en blanco, y dejar trabajar. Es la misma decisión que con el borrador
 * ilegible.
 */
export function cargarDisenoGuardado(
	ruta: string,
): Promise<DisenoPorLado | null> {
	if (!rutaDeDisenoValida(ruta)) return Promise.resolve(null);

	const yaVa = enCurso.get(ruta);
	if (yaVa) return yaVa;

	const promesa = traer(ruta);
	enCurso.set(ruta, promesa);
	return promesa;
}

async function traer(ruta: string): Promise<DisenoPorLado | null> {
	try {
		// Mismo origen: en producción lo sirve CloudFront desde el bucket cerrado,
		// y en desarrollo el rewrite de `next.config.ts` hacia la Lambda.
		const res = await fetch(ruta);
		if (!res.ok) return null;

		const datos = await res.json();
		if (!datos || typeof datos !== "object" || Array.isArray(datos))
			return null;

		// Se filtra a lo que de verdad es una lista de objetos: un JSON con otra
		// forma reventaría dentro de Fabric, y allí el error no dice de dónde vino.
		const limpio: DisenoPorLado = {};
		for (const [lado, objetos] of Object.entries(datos)) {
			if (Array.isArray(objetos)) limpio[lado] = objetos as object[];
		}

		return Object.keys(limpio).length > 0 ? limpio : null;
	} catch {
		return null;
	}
}

/**
 * La ruta que pide la URL, si la trae.
 *
 * Se lee de `window.location` y NO con `useSearchParams`: la página del editor
 * es una ruta estática con `generateStaticParams`, y `useSearchParams` la
 * obligaría a un límite de `<Suspense>` para no reventar el pre-renderizado.
 * Esto corre dentro de un efecto, o sea sólo en el navegador, así que no hay
 * discrepancia de hidratación que temer.
 */
export function rutaDisenoDeLaUrl(): string | null {
	if (typeof window === "undefined") return null;
	const ruta = new URLSearchParams(window.location.search).get("diseno");
	return rutaDeDisenoValida(ruta) ? ruta : null;
}
